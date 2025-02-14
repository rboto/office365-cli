# graph teams unarchive

Restores an archived Microsoft Teams team

## Usage

```sh
graph teams unarchive [options]
```

## Options

Option|Description
------|-----------
`--help`|output usage information
`-i, --teamId <teamId>`|The ID of the Microsoft Teams team to restore
`-o, --output [output]`|Output type. `json|text`. Default `text`
`--verbose`|Runs command with verbose logging
`--debug`|Runs command with debug logging

## Remarks

This command supports admin permissions. Global admins and Microsoft Teams service admins can restore teams that they are not a member of.

This command restores users' ability to send messages and edit the team, abiding by tenant and team settings.

## Examples

Restore an archived Microsoft Teams team

```sh
graph teams unarchive --teamId 6f6fd3f7-9ba5-4488-bbe6-a789004d0d55
```