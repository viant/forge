import assert from 'node:assert/strict';
import {runUICommand} from './commands.js';

const command={method:'ui.workspace.setVisibility',params:{conversationId:'chat-a',hidden:true}};
await assert.rejects(runUICommand(command),/unavailable/);
let complete;
const pending=runUICommand(command,{setWorkspaceVisibility(input){
  assert.equal(input,command.params);
  return new Promise(resolve=>{complete=resolve;});
}});
const receipt={status:'saved',storage:'browser'};
complete(receipt);
assert.deepEqual(await pending,receipt);
await assert.rejects(runUICommand({...command,params:{hidden:true}}),/conversationId/);
