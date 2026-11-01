// Body telemetry is separate from owner camera controls and does not mutate state.
export function bodySnapshot(avatar,walker,interaction,paused){
 const frame=interaction?.frame,active=interaction?.phase==='active';
 return {x:avatar.position.x,y:avatar.position.y,z:avatar.position.z,yaw:avatar.rotation.y,pose:frame?(active?interaction.pose:'transition'):'stand',moving:!paused&&walker.state.speed>.002};
}
export function feedbackEnvelope(session,body,interaction,visible,paused=false){return {session_id:session,visible,paused,body,job_id:interaction?.jobId||null}}
