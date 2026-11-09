import {randomUUID} from 'node:crypto';
export function repository(sql){return {
 async limit(bucket){const r=await sql`INSERT INTO auth_limits(bucket,hits,expires_at) VALUES(${bucket},1,now()+interval '15 minutes') ON CONFLICT(bucket) DO UPDATE SET hits=CASE WHEN auth_limits.expires_at<now() THEN 1 ELSE auth_limits.hits+1 END, expires_at=CASE WHEN auth_limits.expires_at<now() THEN now()+interval '15 minutes' ELSE auth_limits.expires_at END RETURNING hits`;return r[0].hits<=20;},
 async invite(codeHash,label){const id=randomUUID();await sql`INSERT INTO invitations(id,code_hash,label) VALUES(${id},${codeHash},${label})`;return id;},
 async start(codeHash){const r=await sql`UPDATE invitations SET started_at=coalesce(started_at,now()) WHERE code_hash=${codeHash} RETURNING id`;return r[0]?.id;},
 async state(id){const r=await sql`SELECT i.id,i.draft,i.draft_updated_at,EXISTS(SELECT 1 FROM submissions s WHERE s.attempt_id=i.id) AS submitted FROM invitations i WHERE i.id=${id}`;return r[0];},
 async draft(id,answers){await sql`UPDATE invitations SET draft=${JSON.stringify(answers)}::jsonb,draft_updated_at=now() WHERE id=${id} AND NOT EXISTS(SELECT 1 FROM submissions WHERE attempt_id=${id})`;},
 async submit(id,version,answers,report){const r=await sql`INSERT INTO submissions(attempt_id,version,answers,report) VALUES(${id},${version},${JSON.stringify(answers)}::jsonb,${JSON.stringify(report)}::jsonb) ON CONFLICT(attempt_id) DO NOTHING RETURNING attempt_id`;return r.length===1;},
 async results(){return sql`SELECT s.*,i.label,i.started_at FROM submissions s JOIN invitations i ON i.id=s.attempt_id ORDER BY s.submitted_at DESC LIMIT 201`;}
};}
