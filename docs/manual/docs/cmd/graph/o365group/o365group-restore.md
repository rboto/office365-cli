# graph o365group restore

Restores a deleted Office 365 Group

## Usage

```sh
graph o365group restore [options]
```

## Options

Option|Description
------|-----------
`--help`|output usage information
`-i, --id <id>`|The ID of the Office 365 Group to restore
`--verbose`|Runs command with verbose logging
`--debug`|Runs command with debug logging

## Examples

Restores the Office 365 Group with id _28beab62-7540-4db1-a23f-29a6018a3848_

```sh
graph o365group restore --id 28beab62-7540-4db1-a23f-29a6018a3848
```