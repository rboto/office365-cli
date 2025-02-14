import { ContextInfo } from '../../spo';
import request from '../../../../request';
import commands from '../../commands';
import GlobalOptions from '../../../../GlobalOptions';
import {
  CommandOption,
  CommandValidate
} from '../../../../Command';
import SpoCommand from '../../SpoCommand';

const vorpal: Vorpal = require('../../../../vorpal-init');

interface CommandArgs {
  options: Options;
}

interface Options extends GlobalOptions {
  confirm?: boolean;
  id: string;
  location: string;
  webUrl: string;
}

class SpoNavigationNodeRemoveCommand extends SpoCommand {
  public get name(): string {
    return `${commands.NAVIGATION_NODE_REMOVE}`;
  }

  public get description(): string {
    return 'Removes the specified navigation node';
  }

  public getTelemetryProperties(args: CommandArgs): any {
    const telemetryProps: any = super.getTelemetryProperties(args);
    telemetryProps.location = args.options.location;
    telemetryProps.confirm = typeof args.options.confirm !== 'undefined';
    return telemetryProps;
  }

  public commandAction(cmd: CommandInstance, args: CommandArgs, cb: () => void): void {
    const removeNode: () => void = (): void => {
      this
        .getRequestDigest(args.options.webUrl)
        .then((res: ContextInfo): Promise<void> => {
          if (this.verbose) {
            cmd.log(`Removing navigation node...`);
          }

          const requestOptions: any = {
            url: `${args.options.webUrl}/_api/web/navigation/${args.options.location.toLowerCase()}/getbyid(${args.options.id})`,
            headers: {
              accept: 'application/json;odata=nometadata',
              'X-RequestDigest': res.FormDigestValue
            },
            json: true
          };

          return request.delete(requestOptions);
        })
        .then((): void => {
          if (this.verbose) {
            cmd.log(vorpal.chalk.green('DONE'));
          }

          cb();
        }, (rawRes: any): void => this.handleRejectedODataJsonPromise(rawRes, cmd, cb));
    };

    if (args.options.confirm) {
      removeNode();
    }
    else {
      cmd.prompt({
        type: 'confirm',
        name: 'continue',
        default: false,
        message: `Are you sure you want to remove the node ${args.options.id} from the navigation?`,
      }, (result: { continue: boolean }): void => {
        if (!result.continue) {
          cb();
        }
        else {
          removeNode();
        }
      });
    }
  }

  public options(): CommandOption[] {
    const options: CommandOption[] = [
      {
        option: '-u, --webUrl <webUrl>',
        description: 'Absolute URL of the site to which navigation should be modified'
      },
      {
        option: '-l, --location <location>',
        description: 'Navigation type where the node should be added. Available options: QuickLaunch|TopNavigationBar',
        autocomplete: ['QuickLaunch', 'TopNavigationBar']
      },
      {
        option: '-i, --id <id>',
        description: 'ID of the node to remove'
      },
      {
        option: '--confirm',
        description: 'Don\'t prompt for confirming removing the node'
      }
    ];

    const parentOptions: CommandOption[] = super.options();
    return options.concat(parentOptions);
  }

  public validate(): CommandValidate {
    return (args: CommandArgs): boolean | string => {
      if (!args.options.webUrl) {
        return 'Required option webUrl missing';
      }

      const isValidSharePointUrl: boolean | string = SpoCommand.isValidSharePointUrl(args.options.webUrl);
      if (isValidSharePointUrl !== true) {
        return isValidSharePointUrl;
      }

      if (!args.options.location) {
        return 'Required option location missing';
      }
      else {
        if (args.options.location !== 'QuickLaunch' &&
          args.options.location !== 'TopNavigationBar') {
          return `${args.options.location} is not a valid value for the location option. Allowed values are QuickLaunch|TopNavigationBar`;
        }
      }

      if (!args.options.id) {
        return 'Required option id missing';
      }

      const id: number = parseInt(args.options.id);
      if (isNaN(id)) {
        return `${args.options.id} is not a number`;
      }

      return true;
    };
  }

  public commandHelp(args: CommandArgs, log: (message: string) => void): void {
    log(vorpal.find(commands.NAVIGATION_NODE_REMOVE).helpInformation());
    log(
      `  Examples:
  
    Remove a node from the top navigation. Will prompt for confirmation
      ${commands.NAVIGATION_NODE_REMOVE} --webUrl https://contoso.sharepoint.com/sites/team-a --location TopNavigationBar --id 2003

    Remove a node from the quick launch without prompting for confirmation
      ${commands.NAVIGATION_NODE_REMOVE} --webUrl https://contoso.sharepoint.com/sites/team-a --location QuickLaunch --id 2003 --confirm
`);
  }
}

module.exports = new SpoNavigationNodeRemoveCommand();