import test from 'node:test';
import assert from 'node:assert/strict';
import {prudentDailyVolume,prudentListingCapacity} from '../core/market-volume.js';
import {capacityFor} from '../core/allocator-v6.js';

test('14d activity without 7d series must not become a fictitious 50% sales drop',()=>{
 const activity={observations:11,activeDays:9,observedDaily:20};
 assert.equal(prudentDailyVolume(activity,null),20);
 assert.equal(prudentListingCapacity({activity,craftAmount:5},.2),0); // 4 observed units, less than a 5-unit craft batch
 assert.equal(prudentListingCapacity({activity,craftAmount:1},.1),2);
 assert.equal(capacityFor({id:'T5_MAIN_AXE',city:'Martlock',mode:'listed',activity,craftAmount:1},.1,0),28); // un horizonte de 14 días, sin inventar una caída por ausencia de 7d
 assert.equal(prudentDailyVolume(null,null),null); // missing both histories is still uncertainty
});
