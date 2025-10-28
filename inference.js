/* inference.js
   Forward chaining + Certainty Factor combining.
   Expose: loadRules(url), runInference(rulesData, userInputs)
*/

async function loadRules(url = 'rules.json') {
  const r = await fetch(url);
  const data = await r.json();
  return data;
}

function combineCF(cf1, cf2) {
  // combine two positive evidences
  return cf1 + cf2 * (1 - cf1);
}

function evalRule(rule, facts) {
  const premiseCFs = [];
  for (let p of rule.if) {
    const cf = facts[p];
    if (cf === undefined || cf === null) return 0;
    premiseCFs.push(cf);
  }
  const minPremise = Math.min(...premiseCFs);
  const ruleEffect = rule.cf * minPremise;
  return ruleEffect;
}

function forwardChain(rules, initialFacts) {
  const facts = {...initialFacts};
  const trace = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (const rule of rules) {
      const resultCF = evalRule(rule, facts);
      if (resultCF <= 0) continue;
      const concl = rule.then;
      const prevCF = (facts[concl] !== undefined) ? facts[concl] : null;
      if (prevCF === null) {
        facts[concl] = resultCF;
        trace.push({ ruleId: rule.id, conclusion: concl, contribution: Number(resultCF.toFixed(6)), desc: rule.desc });
        changed = true;
      } else {
        const combined = combineCF(prevCF, resultCF);
        if (Math.abs(combined - prevCF) > 1e-6) {
          facts[concl] = combined;
          trace.push({ ruleId: rule.id, conclusion: concl, previous: Number(prevCF.toFixed(6)), contribution: Number(resultCF.toFixed(6)), combined: Number(combined.toFixed(6)), desc: rule.desc });
          changed = true;
        }
      }
    }
  }
  return { facts, trace };
}

function uncertainLabelToCF(label, meta) {
  if (!label) return 0;
  return meta.uncertain_terms[label] ?? 0;
}

function runInference(rulesData, userInputs) {
  const initialFacts = {};
  const meta = rulesData.metadata || { uncertain_terms: { "Tidak":0,"Mungkin":0.4,"Yakin":0.6,"Sangat Yakin":0.8} };
  for (const [k, vLabel] of Object.entries(userInputs)) {
    const v = uncertainLabelToCF(vLabel, meta);
    initialFacts[k] = v;
  }
  const result = forwardChain(rulesData.rules, initialFacts);
  const diagnoses = [];
  for (const [key, val] of Object.entries(result.facts)) {
    if (key.startsWith('K-') && val > 0) {
      diagnoses.push({ code: key, cf: Number(val.toFixed(6)) });
    }
  }
  diagnoses.sort((a,b) => b.cf - a.cf);
  return {
    diagnoses,
    trace: result.trace,
    facts: result.facts
  };
}

window.EI = {
  loadRules,
  runInference
};
