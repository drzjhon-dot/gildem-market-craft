import test from 'node:test';
import assert from 'node:assert/strict';
import {BRANCH_CATEGORIES, branchByKey, categoryForBranch, branchIsRoyalOnly, branchIconId, categoryIconId} from '../core/branches.js';
import {specialType} from '../core/special-recipes.js';

test('separates offhands from accessories and adds kits + siege categories',()=>{
  assert(BRANCH_CATEGORIES.some(x=>x.key==='offhands'));
  assert(BRANCH_CATEGORIES.some(x=>x.key==='kits'));
  assert(BRANCH_CATEGORIES.some(x=>x.key==='siege'));
  assert.equal(categoryForBranch('offhand'),'offhands');
  assert.equal(categoryForBranch('bags'),'accessories');
  assert.equal(categoryForBranch('gather_tool_tracking'),'kits');
  assert.equal(categoryForBranch('siege'),'siege');
  assert.equal(branchIsRoyalOnly('gather_tool_tracking'),true);
  assert.equal(branchIsRoyalOnly('siege'),true);
  assert.equal(branchIsRoyalOnly('offhand'),false);
});

test('adds icon ids and actual branches for kits and siege',()=>{
  assert.equal(categoryIconId('offhands'),'T4_OFF_TORCH');
  assert.equal(categoryIconId('kits'),'T4_2H_TOOL_TRACKING');
  assert.equal(categoryIconId('siege'),'T4_2H_TOOL_SIEGEHAMMER');
  assert.equal(branchByKey('siege').label,'Martillos de asedio');
  assert.equal(branchIconId('siege'),'T4_2H_TOOL_SIEGEHAMMER');
  assert.equal(branchByKey('siege').test('T4_2H_TOOL_SIEGEHAMMER'),true);
});

test('special recipe typing recognizes kits and siege',()=>{
  assert.equal(specialType('T4_2H_TOOL_TRACKING'),'kit');
  assert.equal(specialType('T4_2H_TOOL_SIEGEHAMMER'),'siege');
});
