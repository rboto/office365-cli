import request from '../../../../request';
import commands from '../../commands';
import GlobalOptions from '../../../../GlobalOptions';
import {
  CommandOption,
  CommandValidate
} from '../../../../Command';
import SpoCommand from '../../SpoCommand';
import Utils from '../../../../Utils';
import { CustomAction } from './customaction';
import { BasePermissions, PermissionKind } from './../../common/base-permissions';

const vorpal: Vorpal = require('../../../../vorpal-init');

interface CommandArgs {
  options: Options;
}

interface Options extends GlobalOptions {
  url: string;
  id: string;
  name?: string;
  title?: string;
  location?: string;
  group?: string;
  description?: string;
  sequence?: number;
  actionUrl?: string;
  imageUrl?: string;
  commandUIExtension?: string;
  registrationId?: string;
  registrationType?: string;
  rights?: string;
  scriptSrc?: string;
  scriptBlock?: string;
  scope?: string;
  clientSideComponentId?: string;
  clientSideComponentProperties?: string;
}

class SpoCustomActionSetCommand extends SpoCommand {
  public get name(): string {
    return `${commands.CUSTOMACTION_SET}`;
  }

  public get description(): string {
    return 'Updates a user custom action for site or site collection';
  }

  /**
   * Maps the base PermissionsKind enum to string array so it can 
   * more easily be used in validation or descriptions.
   */
  protected get permissionsKindMap(): string[] {
    const result: string[] = [];

    for (let kind in PermissionKind) {
      if (typeof PermissionKind[kind] === 'number') {
        result.push(kind);
      }
    }
    return result;
  }

  public getTelemetryProperties(args: CommandArgs): any {
    const telemetryProps: any = super.getTelemetryProperties(args);
    telemetryProps.location = args.options.location;
    telemetryProps.scope = args.options.scope || 'Web';
    telemetryProps.group = (!(!args.options.group)).toString();
    telemetryProps.description = (!(!args.options.description)).toString();
    telemetryProps.sequence = (!(!args.options.sequence)).toString();
    telemetryProps.actionUrl = (!(!args.options.actionUrl)).toString();
    telemetryProps.imageUrl = (!(!args.options.imageUrl)).toString();
    telemetryProps.commandUIExtension = (!(!args.options.commandUIExtension)).toString();
    telemetryProps.registrationId = args.options.registrationId;
    telemetryProps.registrationType = args.options.registrationType;
    telemetryProps.rights = args.options.rights;
    telemetryProps.scriptSrc = (!(!args.options.scriptSrc)).toString();
    telemetryProps.scriptBlock = (!(!args.options.scriptBlock)).toString();
    telemetryProps.clientSideComponentId = (!(!args.options.clientSideComponentId)).toString();
    telemetryProps.clientSideComponentProperties = (!(!args.options.clientSideComponentProperties)).toString();
    return telemetryProps;
  }

  public commandAction(cmd: CommandInstance, args: CommandArgs, cb: () => void): void {
    ((): Promise<CustomAction | undefined> => {
      if (!args.options.scope) {
        args.options.scope = 'All';
      }

      if (args.options.scope.toLowerCase() !== "all") {
        return this.updateCustomAction(args.options);
      }

      return this.searchAllScopes(args.options);
    })()
      .then((customAction: CustomAction | undefined): void => {
        if (this.verbose) {
          if (customAction && customAction["odata.null"] === true) {
            cmd.log(`Custom action with id ${args.options.id} not found`);
          } else {
            cmd.log(vorpal.chalk.green('DONE'));
          }
        }
        cb();
      }, (err: any): void => this.handleRejectedPromise(err, cmd, cb));
  }

  public options(): CommandOption[] {
    const options: CommandOption[] = [
      {
        option: '-u, --url <url>',
        description: 'Url of the site or site collection to update the custom action'
      },
      {
        option: '-i, --id <id>',
        description: 'ID of the custom action to update'
      },
      {
        option: '-n, --name [name]',
        description: 'The name of the custom action'
      },
      {
        option: '-t, --title [title]',
        description: 'The title of the custom action'
      },
      {
        option: '-l, --location [location]',
        description: 'The actual location where this custom action need to be added like "CommandUI.Ribbon"'
      },
      {
        option: '-g, --group [group]',
        description: 'The group of the custom action like "SiteActions"'
      },
      {
        option: '-d, --description [description]',
        description: 'The description of the custom action'
      },
      {
        option: '--sequence [sequence]',
        description: 'Sequence of this CustomAction being injected. Use when you have a specific sequence with which to have multiple CustomActions being added to the page'
      },
      {
        option: '--actionUrl [actionUrl]',
        description: 'The URL, URI or JavaScript function associated with the action. URL example ~site/_layouts/sampleurl.aspx or ~sitecollection/_layouts/sampleurl.aspx'
      },
      {
        option: '--imageUrl [imageUrl]',
        description: 'The URL of the image associated with the custom action'
      },
      {
        option: '-e, --commandUIExtension [commandUIExtension]',
        description: 'XML fragment that determines user interface properties of the custom action'
      },
      {
        option: '--registrationId [registrationId]',
        description: 'Specifies the identifier of the list or item content type that this action is associated with, or the file type or programmatic identifier'
      },
      {
        option: '--registrationType [registrationType]',
        description: 'Specifies the type of object associated with the custom action. Allowed values None|List|ContentType|ProgId|FileType. Default None',
        autocomplete: ['None', 'List', 'ContentType', 'ProgId', 'FileType']
      },
      {
        option: '--rights [rights]',
        description: `A case-sensitive string array that contain the permissions needed for the custom action. Allowed values ${this.permissionsKindMap.join('|')}. Default ${this.permissionsKindMap[0]}`,
        autocomplete: this.permissionsKindMap
      },
      {
        option: '-s, --scope [scope]',
        description: 'Scope of the existing custom action. Allowed values Site|Web|All. Default All. Note, this would not update the scope, but might speed up the execution of the scope of the custom action is known.',
        autocomplete: ['Site', 'Web', 'All']
      },
      {
        option: '--scriptBlock [scriptBlock]',
        description: 'Specifies a block of script to be executed. This attribute is only applicable when the Location attribute is set to ScriptLink'
      },
      {
        option: '--scriptSrc [scriptSrc]',
        description: 'Specifies a file that contains script to be executed. This attribute is only applicable when the Location attribute is set to ScriptLink'
      },
      {
        option: '-c, --clientSideComponentId [clientSideComponentId]',
        description: 'The Client Side Component Id (GUID) of the custom action'
      },
      {
        option: '-p, --clientSideComponentProperties [clientSideComponentProperties]',
        description: 'The Client Side Component Properties of the custom action. Specify values as a JSON string : "{Property1 : "Value1", Property2: "Value2"}"'
      }
    ];
    const parentOptions: CommandOption[] = super.options();
    return options.concat(parentOptions);
  }

  public validate(): CommandValidate {
    return (args: CommandArgs): boolean | string => {
      if (Utils.isValidGuid(args.options.id) === false) {
        return `${args.options.id} is not valid. Custom action id (Guid) expected`;
      }

      if (!args.options.url || SpoCommand.isValidSharePointUrl(args.options.url) !== true) {
        return 'Missing required option url';
      }

      if (!args.options.title && !args.options.name && !args.options.location &&
        !args.options.actionUrl && !args.options.clientSideComponentId && !args.options.clientSideComponentProperties &&
        !args.options.commandUIExtension && !args.options.group && !args.options.imageUrl &&
        !args.options.description && !args.options.registrationId && !args.options.registrationType &&
        !args.options.rights && !args.options.scriptBlock && !args.options.scriptSrc &&
        !args.options.sequence) {
        return 'Please specify option to be updated';
      }

      if (args.options.scriptSrc && args.options.scriptBlock) {
        return 'Either option scriptSrc or scriptBlock can be specified, but not both';
      }

      if (args.options.sequence && (args.options.sequence < 0 || args.options.sequence > 65536)) {
        return 'Invalid option sequence. Expected value in range from 0 to 65536';
      }

      if (args.options.clientSideComponentId && Utils.isValidGuid(args.options.clientSideComponentId) === false) {
        return `ClientSideComponentId ${args.options.clientSideComponentId} is not a valid GUID`;
      }

      if (args.options.scope &&
        args.options.scope !== 'Site' &&
        args.options.scope !== 'Web' &&
        args.options.scope !== 'All'
      ) {
        return `${args.options.scope} is not a valid custom action scope. Allowed values are Site|Web|All`;
      }

      if (args.options.rights) {
        const rights = args.options.rights.split(',');

        for (let item of rights) {
          const kind: PermissionKind = PermissionKind[(item.trim() as keyof typeof PermissionKind)];

          if (!kind) {
            return `Rights option '${item}' is not recognized as valid PermissionKind choice. Please note it is case-sensitive`;
          }
        }
      }

      return true;
    };
  }

  public commandHelp(args: CommandArgs, log: (help: string) => void): void {
    const chalk = vorpal.chalk;
    log(vorpal.find(commands.CUSTOMACTION_SET).helpInformation());
    log(
      `  Remarks:
          
    Running this command from the Windows Command Shell (cmd.exe) or PowerShell
    for Windows OS XP, 7, 8, 8.1 without bash installed might require additional
    formatting for command options that have JSON, XML or JavaScript values,
    because the command shell treat quotes differently. For example, this is how
    ApplicationCustomizer user custom action can be created from the Windows
    cmd.exe:

      o365 spo ${commands.CUSTOMACTION_SET} -u https://contoso.sharepoint.com/sites/test -i 058140e3-0e37-44fc-a1d3-79c487d371a3 -p '{\"testMessage\":\"Test message\"}'
    
    Note, how the clientSideComponentProperties option (-p) has escaped double
    quotes ${chalk.grey(`'{\"testMessage\":\"Test message\"}'`)} compared to execution from bash or
    immersive mode: ${chalk.grey(`'{"testMessage":"Test message"}'`)}.

    The ${chalk.grey(`--rights`)} option accepts case-sensitive values.

    Note, specifying the scope option might speed up the execution of the
    command, but would not update the scope. If the scope has to be changed,
    then the existing custom action should be removed and new should be added
    with different scope.

  Examples:
    
    Updates tenant-wide SharePoint Framework Application Customizer extension
    properties in site ${chalk.grey('https://contoso.sharepoint.com/sites/test')}
      ${commands.CUSTOMACTION_SET} -u https://contoso.sharepoint.com/sites/test -i 058140e3-0e37-44fc-a1d3-79c487d371a3 -p '{"testMessage":"Test message"}'
    
    Updates tenant-wide SharePoint Framework ${chalk.blue('modern list view')} Command Set
    extension properties and sequence in site ${chalk.grey('https://contoso.sharepoint.com/sites/test')}
      ${commands.CUSTOMACTION_SET} -u https://contoso.sharepoint.com/sites/test -i 058140e3-0e37-44fc-a1d3-79c487d371a3 -p '{"sampleTextOne":"One item is selected in the list.", "sampleTextTwo":"This command is always visible."}' --sequence 100
    
    Updates url custom action in the SiteActions menu in site
    ${chalk.grey('https://contoso.sharepoint.com/sites/test')}
      ${commands.CUSTOMACTION_SET} -u https://contoso.sharepoint.com/sites/test -i 058140e3-0e37-44fc-a1d3-79c487d371a3 --actionUrl "~site/SitePages/Home.aspx"
    
    Updates ScriptLink custom action with script source in ${chalk.blue('classic pages')} in
    site collection ${chalk.grey('https://contoso.sharepoint.com/sites/test')}
      ${commands.CUSTOMACTION_SET} -u https://contoso.sharepoint.com/sites/test -i 058140e3-0e37-44fc-a1d3-79c487d371a3 --scriptSrc "~sitecollection/SiteAssets/YourScript.js"
    
    Updates custom action with delegated rights in the SiteActions menu in site
    ${chalk.grey('https://contoso.sharepoint.com/sites/test')}
      ${commands.CUSTOMACTION_SET} -u https://contoso.sharepoint.com/sites/test -i 058140e3-0e37-44fc-a1d3-79c487d371a3 --rights "AddListItems,DeleteListItems,ManageLists"
  
  More information:

    UserCustomAction REST API resources:
      https://msdn.microsoft.com/en-us/library/office/dn531432.aspx#bk_UserCustomAction
      
    UserCustomAction Locations and Group IDs:
      https://msdn.microsoft.com/en-us/library/office/bb802730.aspx

    UserCustomAction Element:
      https://msdn.microsoft.com/en-us/library/office/ms460194.aspx

    UserCustomAction Rights:
      https://msdn.microsoft.com/en-us/library/office/microsoft.sharepoint.spbasepermissions.aspx

      `);
  }

  private updateCustomAction(options: Options): Promise<undefined> {
    const requestBody: any = this.mapRequestBody(options);

    const requestOptions: any = {
      url: `${options.url}/_api/${options.scope}/UserCustomActions('${encodeURIComponent(options.id)}')`,
      headers: {
        accept: 'application/json;odata=nometadata',
        'X-HTTP-Method': 'MERGE'
      },
      body: requestBody,
      json: true
    };

    return request.post(requestOptions);
  }

  /**
   * Merge request with `web` scope is send first. 
   * If custom action not found then 
   * another merge request is send with `site` scope.
   */
  private searchAllScopes(options: Options): Promise<CustomAction | undefined> {
    return new Promise<CustomAction>((resolve: (customAction: CustomAction | undefined) => void, reject: (error: any) => void): void => {
      options.scope = "Web";

      this
        .updateCustomAction(options)
        .then((webResult: CustomAction | undefined): void => {
          if (webResult === undefined || webResult["odata.null"] !== true) {
            return resolve(webResult);
          }

          options.scope = "Site";
          this
            .updateCustomAction(options)
            .then((siteResult: CustomAction | undefined): void => {
              return resolve(siteResult);
            }, (err: any): void => {
              reject(err);
            });
        }, (err: any): void => {
          reject(err);
        });
    });
  }

  private mapRequestBody(options: Options): any {
    const requestBody: any = {};

    if (options.location) {
      requestBody.Location = options.location;
    }

    if (options.name) {
      requestBody.Name = options.name;
    }

    if (options.title) {
      requestBody.Title = options.title;
    }

    if (options.group) {
      requestBody.Group = options.group;
    }

    if (options.description) {
      requestBody.Description = options.description;
    }

    if (options.sequence) {
      requestBody.Sequence = options.sequence;
    }

    if (options.registrationType) {
      requestBody.RegistrationType = this.getRegistrationType(options.registrationType);
    }

    if (options.registrationId) {
      requestBody.RegistrationId = options.registrationId.toString();
    }

    if (options.actionUrl) {
      requestBody.Url = options.actionUrl;
    }

    if (options.imageUrl) {
      requestBody.ImageUrl = options.imageUrl;
    }

    if (options.clientSideComponentId) {
      requestBody.ClientSideComponentId = options.clientSideComponentId;
    }

    if (options.clientSideComponentProperties) {
      requestBody.ClientSideComponentProperties = options.clientSideComponentProperties;
    }

    if (options.scriptBlock) {
      requestBody.ScriptBlock = options.scriptBlock;
    }

    if (options.scriptSrc) {
      requestBody.ScriptSrc = options.scriptSrc;
    }

    if (options.commandUIExtension) {
      requestBody.CommandUIExtension = `${options.commandUIExtension}`;
    }

    if (options.rights) {
      const permissions: BasePermissions = new BasePermissions();
      const rights = options.rights.split(',');

      for (let item of rights) {
        const kind: PermissionKind = PermissionKind[(item.trim() as keyof typeof PermissionKind)];

        permissions.set(kind);
      }
      requestBody.Rights = {
        High: permissions.high.toString(),
        Low: permissions.low.toString()
      }
    }

    return requestBody;
  }

  private getRegistrationType(registrationType: string): number {
    switch (registrationType.toLowerCase()) {
      case 'list':
        return 1;
      case 'contenttype':
        return 2;
      case 'progid':
        return 3;
      case 'filetype':
        return 4;
    }
    return 0; // None
  }
}

module.exports = new SpoCustomActionSetCommand();