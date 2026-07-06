import test from 'node:test';
import assert from 'node:assert/strict';

import { parsePrefixCommand, mapArgumentsToOptions } from '../src/utils/prefixParser.js';
import { resolveCommandAlias, resolveSubcommandAlias } from '../src/config/commandAliases.js';
import { getPrefixRestriction } from '../src/config/prefixRestrictions.js';
import countCommand from '../src/commands/Fun/count.js';
import helpCommand from '../src/commands/Core/help.js';
import ticketCommand from '../src/commands/Ticket/ticket.js';
import birthdayCommand from '../src/commands/Birthday/birthday.js';

const countData = countCommand.default?.data || countCommand.data || countCommand;
const helpData = helpCommand.default?.data || helpCommand.data || helpCommand;
const ticketData = ticketCommand.default?.data || ticketCommand.data || ticketCommand;
const birthdayData = birthdayCommand.default?.data || birthdayCommand.data || birthdayCommand;

test('parsePrefixCommand should split space-separated arguments', () => {
  const parsed = parsePrefixCommand('!birthday set 3 15', '!');
  assert.deepEqual(parsed, {
    commandName: 'birthday',
    args: ['set', '3', '15'],
  });
});

test('parsePrefixCommand should parse quoted arguments', () => {
  const parsed = parsePrefixCommand('!warn @user "being rude in chat"', '!');
  assert.deepEqual(parsed, {
    commandName: 'warn',
    args: ['@user', 'being rude in chat'],
  });
});

test('resolveCommandAlias should not shadow level or stats commands', () => {
  assert.equal(resolveCommandAlias('level'), 'level');
  assert.equal(resolveCommandAlias('stats'), 'stats');
  assert.equal(resolveCommandAlias('verify'), 'verify');
  assert.equal(resolveCommandAlias('lvl'), 'rank');
  assert.equal(resolveCommandAlias('ss'), 'serverstats');
  assert.equal(resolveCommandAlias('vadmin'), 'verification');
});

test('resolveSubcommandAlias should keep count disable intact', () => {
  assert.equal(resolveSubcommandAlias('disable'), 'disable');
});

test('mapArgumentsToOptions should reject unknown subcommands', () => {
  const options = mapArgumentsToOptions(['notreal'], countData);
  const validation = options.validateRequired();
  assert.equal(validation.valid, false);
  assert.equal(validation.missing[0].name, 'subcommand');
});

test('mapArgumentsToOptions should resolve subcommand aliases', () => {
  const options = mapArgumentsToOptions(['s', '3', '15'], birthdayData);
  assert.equal(options.getSubcommand(), 'set');
  assert.equal(options.getInteger('month'), 3);
  assert.equal(options.getInteger('day'), 15);
});

test('getPrefixRestriction should block slash-only commands', () => {
  const restriction = getPrefixRestriction(helpCommand, [], resolveSubcommandAlias);
  assert.equal(restriction.blocked, true);
});

test('getPrefixRestriction should block ticket command entirely via prefix', () => {
  const restriction = getPrefixRestriction(ticketCommand, ['setup'], resolveSubcommandAlias);
  assert.equal(restriction.blocked, true);
});

test('getPrefixRestriction should allow simple subcommands on mixed commands', () => {
  const restriction = getPrefixRestriction(countCommand, ['status'], resolveSubcommandAlias);
  assert.equal(restriction.blocked, false);
});

test('getPrefixRestriction should allow count disable via prefix', () => {
  const restriction = getPrefixRestriction(countCommand, ['disable'], resolveSubcommandAlias);
  assert.equal(restriction.blocked, false);
});
