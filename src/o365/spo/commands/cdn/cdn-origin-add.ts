import { ContextInfo, ClientSvcResponse, ClientSvcResponseContents } from '../../spo';
import config from '../../../../config';
import request from '../../../../request';
import commands from '../../commands';
import GlobalOptions from '../../../../GlobalOptions';
import {
  CommandOption,
  CommandValidate,
  CommandError
} from '../../../../Command';
import SpoCommand from '../../SpoCommand';
import Utils from '../../../../Utils';

const vorpal: Vorpal = require('../../../../vorpal-init');

interface CommandArgs {
  options: Options;
}

interface Options extends GlobalOptions {
  type: string;
  origin: string;
}

class SpoCdnOriginAddCommand extends SpoCommand {
  public get name(): string {
    return commands.CDN_ORIGIN_ADD;
  }

  public get description(): string {
    return 'Adds CDN origin to the current SharePoint Online tenant';
  }

  public getTelemetryProperties(args: CommandArgs): any {
    const telemetryProps: any = super.getTelemetryProperties(args);
    telemetryProps.cdnType = args.options.type || 'Public';
    return telemetryProps;
  }

  public commandAction(cmd: CommandInstance, args: CommandArgs, cb: (err?: any) => void): void {
    const cdnTypeString: string = args.options.type || 'Public';
    const cdnType: number = cdnTypeString === 'Private' ? 1 : 0;
    let spoAdminUrl: string = '';
    let tenantId: string = '';

    this
      .getTenantId(cmd, this.debug)
      .then((_tenantId: string): Promise<string> => {
        tenantId = _tenantId;
        return this.getSpoAdminUrl(cmd, this.debug);
      })
      .then((_spoAdminUrl: string): Promise<ContextInfo> => {
        spoAdminUrl = _spoAdminUrl;
        return this.getRequestDigest(spoAdminUrl);
      })
      .then((res: ContextInfo): Promise<string> => {
        if (this.verbose) {
          cmd.log(`Adding origin ${args.options.origin} to the ${(cdnType === 1 ? 'Private' : 'Public')} CDN. Please wait, this might take a moment...`);
        }

        const requestOptions: any = {
          url: `${spoAdminUrl}/_vti_bin/client.svc/ProcessQuery`,
          headers: {
            'X-RequestDigest': res.FormDigestValue
          },
          body: `<Request AddExpandoFieldTypeSuffix="true" SchemaVersion="15.0.0.0" LibraryVersion="16.0.0.0" ApplicationName="${config.applicationName}" xmlns="http://schemas.microsoft.com/sharepoint/clientquery/2009"><Actions><Method Name="AddTenantCdnOrigin" Id="27" ObjectPathId="23"><Parameters><Parameter Type="Enum">${cdnType}</Parameter><Parameter Type="String">${Utils.escapeXml(args.options.origin)}</Parameter></Parameters></Method></Actions><ObjectPaths><Identity Id="23" Name="${tenantId}" /></ObjectPaths></Request>`
        };

        return request.post(requestOptions);
      })
      .then((res: string): void => {
        const json: ClientSvcResponse = JSON.parse(res);
        const response: ClientSvcResponseContents = json[0];
        if (response.ErrorInfo) {
          cb(new CommandError(response.ErrorInfo.ErrorMessage));
        }
        else {
          if (this.verbose) {
            cmd.log(vorpal.chalk.green('DONE'));
          }
          cb();
        }
      }, (err: any): void => this.handleRejectedPromise(err, cmd, cb));
  }

  public options(): CommandOption[] {
    const options: CommandOption[] = [
      {
        option: '-t, --type [type]',
        description: 'Type of CDN to manage. Public|Private. Default Public',
        autocomplete: ['Public', 'Private']
      },
      {
        option: '-r, --origin <origin>',
        description: 'Origin to add to the current CDN configuration'
      }
    ];

    const parentOptions: CommandOption[] = super.options();
    return options.concat(parentOptions);
  }

  public validate(): CommandValidate {
    return (args: CommandArgs): boolean | string => {
      if (args.options.type) {
        if (args.options.type !== 'Public' &&
          args.options.type !== 'Private') {
          return `${args.options.type} is not a valid CDN type. Allowed values are Public|Private`;
        }
      }

      return true;
    };
  }

  public commandHelp(args: CommandArgs, log: (help: string) => void): void {
    const chalk = vorpal.chalk;
    log(vorpal.find(commands.CDN_ORIGIN_ADD).helpInformation());
    log(
      `  ${chalk.yellow('Important:')} to use this command you have to have permissions to access
    the tenant admin site.
        
  Remarks:

    Using the ${chalk.blue('-t, --type')} option you can choose whether you want
    to manage the settings of the Public (default) or Private CDN. If you don't
    use the option, the command will use the Public CDN.

  Examples:
  
    Add ${chalk.grey('*/CDN')} to the list of origins of the Public CDN
      ${commands.CDN_ORIGIN_ADD} --type Public --origin */CDN

  More information:

    General availability of Office 365 CDN
      https://dev.office.com/blogs/general-availability-of-office-365-cdn
`);
  }
}

module.exports = new SpoCdnOriginAddCommand();