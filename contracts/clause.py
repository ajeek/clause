# genlayer version: 0.2.18
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import genlayer as gl
from dataclasses import dataclass
import json

@gl.allow_storage
@dataclass
class ClauseEvaluation:
    evaluation_id: gl.u256
    clause_id: gl.u256
    result: str
    evidence: str
    reason_code: str
    evaluated_marker: gl.u256

@gl.allow_storage
@dataclass
class ClauseRecord:
    clause_id: gl.u256
    creator: str
    condition: str
    source: str
    current_result: str
    evaluation_count: gl.u32
    created_marker: gl.u256
    updated_marker: gl.u256
    evaluation_ids: gl.DynArray[gl.u256]

class Clause(gl.Contract):
    """
    Clause v0.1: Immutable condition evaluation protocol.
    """
    clauses: gl.DynArray[ClauseRecord]
    evaluations: gl.DynArray[ClauseEvaluation]
    event_marker: gl.u256

    def __init__(self):
        self.clauses = []
        self.evaluations = []
        self.event_marker = gl.u256(0)

    def _mark(self) -> gl.u256:
        self.event_marker = gl.u256(int(self.event_marker) + 1)
        return self.event_marker

    @gl.public.write
    def create_clause(self, condition: str, source: str) -> gl.u256:
        if not condition or not condition.strip():
            raise gl.vm.UserError("Condition cannot be empty")
        if not source or not source.strip():
            raise gl.vm.UserError("Source cannot be empty")

        clause_id = gl.u256(len(self.clauses))
        marker = self._mark()
        
        new_clause = ClauseRecord(
            clause_id=clause_id,
            creator=str(gl.message.sender_address).lower(),
            condition=condition.strip(),
            source=source.strip(),
            current_result="UNCERTAIN",
            evaluation_count=gl.u32(0),
            created_marker=marker,
            updated_marker=marker,
            evaluation_ids=[]
        )
        self.clauses.append(new_clause)
        return clause_id

    @gl.public.write
    def evaluate_clause(self, clause_id: gl.u256) -> None:
        if clause_id >= len(self.clauses):
            raise gl.vm.UserError("Clause does not exist")
        
        clause = self.clauses[clause_id]
        
        def leader_fn():
            try:
                response = gl.nondet.web.get(clause.source)
                body = response.body
                content = body.decode("utf-8") if isinstance(body, (bytes, bytearray)) else str(body)
            except Exception as e:
                return {
                    "result": "UNCERTAIN",
                    "evidence": f"Failed to retrieve source: {str(e)}",
                    "reason_code": "SOURCE_INACCESSIBLE"
                }
                
            content = content[:12000] if len(content) > 12000 else content
            if not content:
                return {
                    "result": "UNCERTAIN",
                    "evidence": "Source returned empty content",
                    "reason_code": "SOURCE_INACCESSIBLE"
                }
                
            prompt = f"""Evaluate the following condition against the provided source excerpt.

CONDITION: {clause.condition}

SOURCE EXCERPT:
---
{content}
---

Your task is to determine the current state of the condition based ONLY on the source.
You must return a JSON object with exactly these three fields:
- "result": exactly one of ["SATISFIED", "UNSATISFIED", "UNCERTAIN"]
- "evidence": a concise explanation of what the source showed (do not include raw HTML or huge dumps)
- "reason_code": a compact machine-readable string (e.g., "SOURCE_SUPPORTS_CONDITION", "SOURCE_CONTRADICTS_CONDITION", "INSUFFICIENT_EVIDENCE")

Respond with ONLY valid JSON."""

            ai_resp = gl.nondet.exec_prompt(prompt, response_format="json")
            try:
                parsed = json.loads(ai_resp)
                res = str(parsed.get("result", "")).strip().upper()
                ev = str(parsed.get("evidence", "")).strip()
                rc = str(parsed.get("reason_code", "")).strip().upper()
                
                if res not in ["SATISFIED", "UNSATISFIED", "UNCERTAIN"]:
                    res = "UNCERTAIN"
                    rc = "MALFORMED_LLM_RESPONSE"
                    
                if not rc:
                    rc = "NO_REASON_CODE_PROVIDED"
                    
                return {
                    "result": res,
                    "evidence": ev,
                    "reason_code": rc
                }
            except Exception as e:
                return {
                    "result": "UNCERTAIN",
                    "evidence": "Failed to parse LLM response",
                    "reason_code": "MALFORMED_LLM_RESPONSE"
                }

        def validator_fn(leader_result) -> bool:
            if not isinstance(leader_result, gl.vm.Return):
                return False
            leader_data = leader_result.calldata
            if not isinstance(leader_data, dict):
                return False
                
            mine = leader_fn()
            
            # Substantive result must match
            if mine.get("result") != leader_data.get("result"):
                return False
                
            return True

        eval_result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
        if not isinstance(eval_result, dict):
            raise gl.vm.UserError("GenLayer evaluation returned unexpected format")
            
        marker = self._mark()
        evaluation_id = gl.u256(len(self.evaluations))
        
        new_eval = ClauseEvaluation(
            evaluation_id=evaluation_id,
            clause_id=clause_id,
            result=eval_result["result"],
            evidence=eval_result.get("evidence", ""),
            reason_code=eval_result.get("reason_code", ""),
            evaluated_marker=marker
        )
        self.evaluations.append(new_eval)
        
        clause.current_result = eval_result["result"]
        clause.evaluation_count = gl.u32(int(clause.evaluation_count) + 1)
        clause.updated_marker = marker
        clause.evaluation_ids.append(evaluation_id)
        
        self.clauses[clause_id] = clause

    @gl.public.view
    def get_clause(self, clause_id: gl.u256) -> dict:
        if clause_id >= len(self.clauses):
            raise gl.vm.UserError("Clause does not exist")
            
        clause = self.clauses[clause_id]
        return {
            "id": int(clause.clause_id),
            "creator": clause.creator,
            "condition": clause.condition,
            "source": clause.source,
            "current_result": clause.current_result,
            "evaluation_count": int(clause.evaluation_count),
            "created_marker": int(clause.created_marker),
            "updated_marker": int(clause.updated_marker)
        }

    @gl.public.view
    def get_evaluation(self, evaluation_id: gl.u256) -> dict:
        if evaluation_id >= len(self.evaluations):
            raise gl.vm.UserError("Evaluation does not exist")
            
        eval_rec = self.evaluations[evaluation_id]
        return {
            "id": int(eval_rec.evaluation_id),
            "clause_id": int(eval_rec.clause_id),
            "result": eval_rec.result,
            "evidence": eval_rec.evidence,
            "reason_code": eval_rec.reason_code,
            "evaluated_marker": int(eval_rec.evaluated_marker)
        }

    @gl.public.view
    def get_clause_history(self, clause_id: gl.u256) -> list:
        if clause_id >= len(self.clauses):
            raise gl.vm.UserError("Clause does not exist")
            
        clause = self.clauses[clause_id]
        history = []
        for eid in clause.evaluation_ids:
            eval_rec = self.evaluations[eid]
            history.append({
                "id": int(eval_rec.evaluation_id),
                "clause_id": int(eval_rec.clause_id),
                "result": eval_rec.result,
                "evidence": eval_rec.evidence,
                "reason_code": eval_rec.reason_code,
                "evaluated_marker": int(eval_rec.evaluated_marker)
            })
        # Note: History arrays in UIs usually expect newest first. 
        # But we return in chronological order here; frontend can reverse.
        return history

    @gl.public.view
    def get_stats(self) -> dict:
        return {
            "total_clauses": len(self.clauses),
            "total_evaluations": len(self.evaluations)
        }
