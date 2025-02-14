import Command, { CommandAction, CommandError } from '../../Command';
import auth, { Logger } from '../../Auth';
import request from '../../request';
import { SpoOperation } from './commands/site/SpoOperation';
import config from '../../config';
import { FormDigestInfo, ClientSvcResponse, ClientSvcResponseContents, ContextInfo } from './spo';

export interface FormDigest {
  formDigestValue: string;
  formDigestExpiresAt: Date;
}

export default abstract class SpoCommand extends Command {
  public action(): CommandAction {
    const cmd: SpoCommand = this;

    return function (this: CommandInstance, args: any, cb: (err?: any) => void) {
      auth
        .restoreAuth()
        .then((): void => {
          cmd.initAction(args, this);
          cmd.commandAction(this, args, cb);
        }, (error: any): void => {
          cb(new CommandError(error));
        });
    }
  }

  protected getRequestDigest(siteUrl: string): Promise<FormDigestInfo> {
    const requestOptions: any = {
      url: `${siteUrl}/_api/contextinfo`,
      headers: {
        accept: 'application/json;odata=nometadata'
      },
      json: true
    };

    return request.post(requestOptions);
  }

  public static isValidSharePointUrl(url: string): boolean | string {
    if (!url) {
      return false;
    }

    if (url.indexOf('https://') !== 0) {
      return `${url} is not a valid SharePoint Online site URL`;
    }
    else {
      return true;
    }
  }

  public ensureFormDigest(siteUrl: string, cmd: CommandInstance, context: FormDigestInfo | undefined, debug: boolean): Promise<FormDigestInfo> {
    return new Promise<FormDigestInfo>((resolve: (context: FormDigestInfo) => void, reject: (error: any) => void): void => {
      if (this.isValidFormDigest(context)) {
        if (debug) {
          cmd.log('Existing form digest still valid');
        }

        resolve(context as FormDigestInfo);
        return;
      }

      this
        .getRequestDigest(siteUrl)
        .then((res: FormDigestInfo): void => {
          const now: Date = new Date();
          now.setSeconds(now.getSeconds() + res.FormDigestTimeoutSeconds - 5);
          context = {
            FormDigestValue: res.FormDigestValue,
            FormDigestTimeoutSeconds: res.FormDigestTimeoutSeconds,
            FormDigestExpiresAt: now,
            WebFullUrl: res.WebFullUrl
          };

          resolve(context);
        }, (error: any): void => {
          reject(error);
        });
    });
  }

  private isValidFormDigest(contextInfo: FormDigestInfo | undefined): boolean {
    if (!contextInfo) {
      return false;
    }

    const now: Date = new Date();
    if (contextInfo.FormDigestValue && now < contextInfo.FormDigestExpiresAt) {
      return true;
    }

    return false;
  }

  protected waitUntilFinished(operationId: string, siteUrl: string, resolve: () => void, reject: (error: any) => void, cmd: CommandInstance, currentContext: FormDigestInfo, dots?: string, timeout?: NodeJS.Timer): void {
    this
      .ensureFormDigest(siteUrl, cmd, currentContext, this.debug)
      .then((res: FormDigestInfo): Promise<string> => {
        currentContext = res;

        if (this.debug) {
          cmd.log(`Checking if operation ${operationId} completed...`);
        }

        if (!this.debug && this.verbose) {
          dots += '.';
          process.stdout.write(`\r${dots}`);
        }

        const requestOptions: any = {
          url: `${siteUrl}/_vti_bin/client.svc/ProcessQuery`,
          headers: {
            'X-RequestDigest': currentContext.FormDigestValue
          },
          body: `<Request AddExpandoFieldTypeSuffix="true" SchemaVersion="15.0.0.0" LibraryVersion="16.0.0.0" ApplicationName="${config.applicationName}" xmlns="http://schemas.microsoft.com/sharepoint/clientquery/2009"><Actions><Query Id="188" ObjectPathId="184"><Query SelectAllProperties="false"><Properties><Property Name="IsComplete" ScalarProperty="true" /><Property Name="PollingInterval" ScalarProperty="true" /></Properties></Query></Query></Actions><ObjectPaths><Identity Id="184" Name="${operationId.replace(/\\n/g, '&#xA;').replace(/"/g, '')}" /></ObjectPaths></Request>`
        };

        return request.post(requestOptions);
      })
      .then((res: string): void => {
        const json: ClientSvcResponse = JSON.parse(res);
        const response: ClientSvcResponseContents = json[0];
        if (response.ErrorInfo) {
          reject(response.ErrorInfo.ErrorMessage);
        }
        else {
          const operation: SpoOperation = json[json.length - 1];
          let isComplete: boolean = operation.IsComplete;
          if (isComplete) {
            if (this.verbose) {
              process.stdout.write('\n');
            }

            resolve();
            return;
          }

          timeout = setTimeout(() => {
            this.waitUntilFinished(JSON.stringify(operation._ObjectIdentity_), siteUrl, resolve, reject, cmd, currentContext, dots);
          }, operation.PollingInterval);
        }
      });
  }

  protected getSpoUrl(stdout: Logger, debug: boolean): Promise<string> {
    if (auth.service.spoUrl) {
      if (debug) {
        stdout.log(`SPO URL previously retrieved ${auth.service.spoUrl}. Returning...`);
      }

      return Promise.resolve(auth.service.spoUrl);
    }

    return new Promise<string>((resolve: (spoUrl: string) => void, reject: (error: any) => void): void => {
      if (debug) {
        stdout.log(`No SPO URL available. Retrieving from MS Graph...`);
      }

      const requestOptions: any = {
        url: `https://graph.microsoft.com/v1.0/sites/root?$select=webUrl`,
        headers: {
          'accept': 'application/json;odata.metadata=none'
        },
        json: true
      };

      request
        .get<{ webUrl: string }>(requestOptions)
        .then((res: { webUrl: string }): Promise<void> => {
          auth.service.spoUrl = res.webUrl;
          return auth.storeConnectionInfo();
        })
        .then((): void => {
          resolve(auth.service.spoUrl as string);
        }, (err: any): void => {
          if (auth.service.spoUrl) {
            resolve(auth.service.spoUrl);
          }
          else {
            reject(err);
          }
        });
    });
  }

  protected getSpoAdminUrl(stdout: Logger, debug: boolean): Promise<string> {
    return new Promise<string>((resolve: (spoAdminUrl: string) => void, reject: (error: any) => void): void => {
      this
        .getSpoUrl(stdout, debug)
        .then((spoUrl: string): void => {
          resolve(spoUrl.replace(/(https:\/\/)([^\.]+)(.*)/, '$1$2-admin$3'));
        }, (error: any): void => {
          reject(error);
        });
    });
  }

  protected getTenantId(stdout: Logger, debug: boolean): Promise<string> {
    if (auth.service.tenantId) {
      if (debug) {
        stdout.log(`SPO Tenant ID previously retrieved ${auth.service.tenantId}. Returning...`);
      }

      return Promise.resolve(auth.service.tenantId);
    }

    return new Promise<string>((resolve: (spoUrl: string) => void, reject: (error: any) => void): void => {
      if (debug) {
        stdout.log(`No SPO Tenant ID available. Retrieving...`);
      }

      let spoAdminUrl: string = '';

      this
        .getSpoAdminUrl(stdout, debug)
        .then((_spoAdminUrl: string): Promise<ContextInfo> => {
          spoAdminUrl = _spoAdminUrl;
          return this.getRequestDigest(spoAdminUrl);
        })
        .then((contextInfo: ContextInfo): Promise<string> => {
          const tenantInfoRequestOptions = {
            url: `${spoAdminUrl}/_vti_bin/client.svc/ProcessQuery`,
            headers: {
              'X-RequestDigest': contextInfo.FormDigestValue,
              accept: 'application/json;odata=nometadata'
            },
            body: `<Request AddExpandoFieldTypeSuffix="true" SchemaVersion="15.0.0.0" LibraryVersion="16.0.0.0" ApplicationName="${config.applicationName}" xmlns="http://schemas.microsoft.com/sharepoint/clientquery/2009"><Actions><ObjectPath Id="4" ObjectPathId="3" /><Query Id="5" ObjectPathId="3"><Query SelectAllProperties="true"><Properties /></Query></Query></Actions><ObjectPaths><Constructor Id="3" TypeId="{268004ae-ef6b-4e9b-8425-127220d84719}" /></ObjectPaths></Request>`
          };

          return request.post(tenantInfoRequestOptions);
        })
        .then((res: string): Promise<void> => {
          const json: string[] = JSON.parse(res);
          auth.service.tenantId = (json[json.length - 1] as any)._ObjectIdentity_.replace('\n', '&#xA;');
          return auth.storeConnectionInfo();
        })
        .then((): void => {
          resolve(auth.service.tenantId as string);
        }, (err: any): void => {
          if (auth.service.tenantId) {
            resolve(auth.service.tenantId);
          }
          else {
            reject(err);
          }
        });
    });
  }
}