const config = window.INNER_CIRCLE_CONFIG;
const app = document.querySelector("#app");
const stateKey = "ss-inner-circle-state-v2";

let route = "member";
let activeCampaignId = config.campaigns[0].id;
let member = null;
let participant = freshParticipant();
let adminDraft = null;
let adminSection = "campaign";

function freshParticipant() {
  const campaign = getCampaign(activeCampaignId);
  return {
    step: 0,
    pairIndex: 0,
    answers: {},
    ranking: [...campaign.conceptIds],
    completed: false
  };
}

function getCampaign(id = activeCampaignId) {
  const campaign = state().campaigns.find((item) => item.id === id) || state().campaigns[0];
  return normaliseCampaign(campaign);
}

function state() {
  const saved = readState();
  const conceptEdits = saved.conceptEdits || {};
  return {
    ...saved,
    brands: config.brands,
    concepts: [...config.concepts, ...(saved.uploadedConcepts || [])].map((concept) => ({
      ...concept,
      ...(conceptEdits[concept.id] || {})
    }))
  };
}

function readState() {
  try {
    return JSON.parse(localStorage.getItem(stateKey)) || seedState();
  } catch {
    return seedState();
  }
}

function seedState() {
  return {
    campaigns: structuredClone(config.campaigns).map(normaliseCampaign),
    uploadedConcepts: [],
    conceptEdits: {},
    responses: sampleResponses(),
    updatedAt: new Date().toISOString()
  };
}

function normaliseCampaign(campaign) {
  const questionIds = campaign.questions.map((question) => question.id);
  const fallbackBlock = {
    id: "default-block",
    title: "Survey questions",
    questionIds
  };

  return {
    schemaVersion: "survey-v1",
    surveyDefinition: {
      engine: "qualtrics-inspired",
      embeddedData: [
        { key: "brandId", value: campaign.brandId },
        { key: "campaignId", value: campaign.id }
      ],
      blocks: [fallbackBlock],
      flow: [{ type: "block", ref: fallbackBlock.id }],
      quotas: [],
      scoring: {
        pairwiseWeight: 45,
        buyingIntentWeight: 40,
        rankingWeight: 15,
        thresholds: { buy: 62, tweak: 42 }
      },
      exportFields: ["campaignId", "member.segment", "answers", "submittedAt"],
      ...(campaign.surveyDefinition || {})
    },
    ...campaign,
    homeCopy: {
      eyebrow: "Private design council",
      title: "Help shape the next Sunday Staples launch",
      body: "Review the same factory concepts Cherri would normally shortlist in person, then tell us what deserves to be bought, tweaked, or rejected.",
      ...(campaign.homeCopy || {})
    },
    questions: campaign.questions.map((question) => ({
      required: false,
      analyticsKey: question.id,
      displayLogic: null,
      validation: null,
      ...question
    }))
  };
}

function writeState(next) {
  localStorage.setItem(stateKey, JSON.stringify({ ...next, updatedAt: new Date().toISOString() }));
}

function sampleResponses() {
  const campaignId = "fy26-factory-shortlist";
  return [
    response(campaignId, "VIP", [["concept-01", "concept-02", "concept-01"], ["concept-03", "concept-04", "concept-04"]], ["concept-04", "concept-01", "concept-05", "concept-08"]),
    response(campaignId, "Friends & Family", [["concept-01", "concept-02", "concept-02"], ["concept-05", "concept-06", "concept-05"]], ["concept-02", "concept-05", "concept-04", "concept-01"]),
    response(campaignId, "VIP", [["concept-03", "concept-04", "concept-04"], ["concept-07", "concept-08", "concept-08"]], ["concept-04", "concept-08", "concept-01", "concept-05"])
  ];
}

function response(campaignId, segment, battles, ranking) {
  return {
    id: crypto.randomUUID(),
    campaignId,
    member: { email: `${segment.toLowerCase().replaceAll(" ", "-")}@example.com`, segment },
    answers: {
      "battle-1": battles.map(([left, right, winner]) => ({ left, right, winner, reason: "Feels easiest to wear often.", drivers: ["Comfort", "Versatility"] })),
      "buying-intent": Object.fromEntries(ranking.map((id, index) => [id, Math.max(3, 5 - index)])),
      ranking,
      colour: "Nude",
      final: "Keep the silhouette clean and test softer linings."
    },
    submittedAt: new Date().toISOString()
  };
}

function conceptsFor(campaign = getCampaign()) {
  return campaign.conceptIds.map((id) => state().concepts.find((concept) => concept.id === id)).filter(Boolean);
}

function conceptsForQuestion(question, campaign = getCampaign()) {
  const ids = question.module?.conceptIds?.length ? question.module.conceptIds : campaign.conceptIds;
  return ids.map((id) => state().concepts.find((concept) => concept.id === id)).filter(Boolean);
}

function aspirationSelection(question, campaign = getCampaign()) {
  const aspirationQuestion = surveyQuestions(campaign).find((item) => item.type === "multi-select" || item.module?.type === "aspiration-pick");
  const selected = aspirationQuestion ? participant.answers[aspirationQuestion.id] : null;
  return selected?.length ? selected : conceptsForQuestion(question, campaign).slice(0, 5).map((concept) => concept.id);
}

function render() {
  app.innerHTML = `
    <div class="shell">
      ${topbar()}
      <main>${route === "admin" ? adminView() : route === "results" ? resultsView() : memberView()}</main>
    </div>
  `;
  bindEvents();
}

function topbar() {
  return `
    <header class="topbar">
      <button class="brand" data-route="member" aria-label="Sunday Staples Inner Circle home">
        <span>SS</span>
        <strong>Inner Circle</strong>
      </button>
      <nav>
        ${navButton("member", "Preview")}
        ${navButton("admin", "Admin")}
        ${navButton("results", "Results")}
      </nav>
    </header>
  `;
}

function navButton(name, label) {
  return `<button class="${route === name ? "active" : ""}" data-route="${name}">${label}</button>`;
}

function memberView() {
  const campaign = getCampaign();
  const questions = surveyQuestions(campaign);
  const question = questions[participant.step];
  if (!member) return accessView(campaign);
  if (participant.completed) return completeView(campaign);
  if (!question) return completeView(campaign);
  if (question.type === "intro") return introView(question, campaign);
  if (question.type === "pairwise") return pairwiseView(question, campaign);
  if (question.type === "rating") return ratingView(question, campaign);
  if (question.type === "ranking") return rankingView(question, campaign);
  if (question.type === "multi-select") return multiSelectView(question, campaign);
  if (question.type === "reason-pool") return reasonPoolView(question, campaign);
  if (question.type === "choice") return choiceView(question);
  return textView(question);
}

function accessView(campaign) {
  return `
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">Invite-only Sunday Perk</p>
        <h1>Shape what Sunday Staples orders next.</h1>
        <p class="lede">A mobile focus room for early factory concepts, pairwise battles, ranking, buying intent, and loyalty rewards.</p>
        <div class="metric-strip">
          <span><strong>${campaign.conceptIds.length}</strong> concepts</span>
          <span><strong>${campaign.questions.length - 1}</strong> prompts</span>
          <span><strong>${campaign.reward}</strong></span>
        </div>
      </div>
      <form class="panel access-panel" data-action="login">
        <p class="eyebrow">Private access</p>
        <h2>${campaign.title}</h2>
        <label>Email<input name="email" type="email" value="vip@sundaystaples.com" required /></label>
        <label>Age range
          <select name="ageRange">
            <option>18-24</option><option selected>25-34</option><option>35-44</option><option>45-54</option><option>55+</option>
          </select>
        </label>
        <button class="primary">Enter preview</button>
        <p class="hint">Pilot emails: maurice@sundaystaples.com, vip@sundaystaples.com, friend@sundaystaples.com</p>
      </form>
    </section>
  `;
}

function introView(question, campaign) {
  const copy = campaign.homeCopy || {};
  return `
    <section class="screen two-col">
      <div>
        <p class="eyebrow">${copy.eyebrow || question.eyebrow}</p>
        <h1>${copy.title || question.title}</h1>
        <p class="lede">${copy.body || question.body}</p>
        <button class="primary" data-next>Start voting</button>
      </div>
      <div class="concept-preview">
        ${conceptsFor(campaign).slice(0, 4).map(conceptTile).join("")}
      </div>
    </section>
  `;
}

function pairwiseView(question) {
  const pair = question.pairs[participant.pairIndex];
  if (!pair) {
    return `
      <section class="screen narrow">
        ${progress()}
        <p class="eyebrow">Side-by-side battle</p>
        <h2>Add at least two concepts to run this comparison.</h2>
        <p class="lede">This module needs two or more selected shoe concepts. Continue to the next module for now.</p>
        <button class="primary" data-next>Continue</button>
      </section>
    `;
  }
  const [left, right] = pair.map(findConcept);
  return `
    <section class="screen">
      ${progress()}
      <p class="eyebrow">Pairwise platform ${participant.pairIndex + 1} of ${question.pairs.length}</p>
      <h2>${question.prompt}</h2>
      <div class="battle-grid">
        ${productCard(left, "Choose left")}
        ${productCard(right, "Choose right")}
      </div>
      <div class="panel compact">
        <label>Why did this win?<textarea id="pairReason" placeholder="Comfort, silhouette, colour, occasion, price confidence..."></textarea></label>
        <div class="chips">
          ${["Comfort", "Versatility", "Colour", "Shape", "Premium feel", "Easy to style"].map((driver) => `<label><input type="checkbox" value="${driver}" />${driver}</label>`).join("")}
        </div>
      </div>
    </section>
  `;
}

function ratingView(question, campaign) {
  const saved = participant.answers[question.id] || {};
  const concepts = conceptsForQuestion(question, campaign);
  return `
    <section class="screen">
      ${progress()}
      <p class="eyebrow">Buying intent</p>
      <h2>${question.prompt}</h2>
      <div class="rating-list">
        ${concepts.map((concept) => `
          <article class="rating-row" data-rating="${concept.id}">
            ${mediaElement(concept)}
            <div><strong>${concept.name}</strong><span>${concept.category} · ${concept.colorway}</span></div>
            <select>
              ${question.scale.map((label, index) => `<option value="${index + 1}" ${Number(saved[concept.id] || 3) === index + 1 ? "selected" : ""}>${index + 1} - ${label}</option>`).join("")}
            </select>
          </article>
        `).join("")}
      </div>
      <button class="primary" data-save-rating>Continue</button>
    </section>
  `;
}

function rankingView(question, campaign) {
  const validIds = conceptsForQuestion(question, campaign).map((concept) => concept.id);
  const ranking = participant.ranking.filter((id) => validIds.includes(id));
  validIds.forEach((id) => {
    if (!ranking.includes(id)) ranking.push(id);
  });
  participant.ranking = ranking;
  return `
    <section class="screen">
      ${progress()}
      <p class="eyebrow">Peer-to-peer ranking</p>
      <h2>${question.prompt}</h2>
      <div class="rank-list">
        ${participant.ranking.map((id, index) => rankRow(findConcept(id), index)).join("")}
      </div>
      <button class="primary" data-next>Continue</button>
    </section>
  `;
}

function choiceView(question) {
  const saved = participant.answers[question.id];
  return `
    <section class="screen narrow">
      ${progress()}
      <p class="eyebrow">Colour direction</p>
      <h2>${question.prompt}</h2>
      <div class="choice-grid">
        ${question.options.map((option) => `<button class="${saved === option ? "selected" : ""}" data-choice="${option}">${option}</button>`).join("")}
      </div>
    </section>
  `;
}

function multiSelectView(question, campaign) {
  const selected = participant.answers[question.id] || [];
  const max = question.maxSelections || question.module?.maxSelections || 5;
  return `
    <section class="screen">
      ${progress()}
      <p class="eyebrow">No-budget aspiration</p>
      <h2>${question.prompt}</h2>
      <p class="lede">Choose up to ${max}. This captures aspiration separately from price sensitivity.</p>
      <div class="option-grid">
        ${conceptsForQuestion(question, campaign).map((concept) => `
          <button class="mini-design ${selected.includes(concept.id) ? "selected" : ""}" data-multi-pick="${concept.id}" type="button">
            ${mediaElement(concept)}
            <strong>${concept.name}</strong>
            <span>${concept.category}</span>
          </button>
        `).join("")}
      </div>
      <div class="button-row">
        <span class="hint">${selected.length} of ${max} selected</span>
        <button class="primary" data-next>Continue</button>
      </div>
    </section>
  `;
}

function reasonPoolView(question, campaign) {
  const sourceIds = aspirationSelection(question, campaign);
  const reasons = question.reasons || question.module?.reasons || defaultReasonPool();
  const saved = participant.answers[question.id] || {};
  return `
    <section class="screen">
      ${progress()}
      <p class="eyebrow">Reason diagnosis</p>
      <h2>${question.prompt}</h2>
      <p class="lede">Choose the reasons that best explain why each top sample stands out.</p>
      <div class="reason-list">
        ${sourceIds.map((id) => reasonCard(findConcept(id), reasons, saved[id] || [])).join("")}
      </div>
      <button class="primary" data-save-reasons>Continue</button>
    </section>
  `;
}

function reasonCard(concept, reasons, selected) {
  if (!concept) return "";
  return `
    <article class="reason-card" data-reason-concept="${concept.id}">
      ${mediaElement(concept)}
      <div>
        <h3>${concept.name}</h3>
        <div class="reason-chip-grid">
          ${reasons.map((reason) => `
            <label class="reason-chip">
              <input type="checkbox" value="${escapeAttr(reason)}" ${selected.includes(reason) ? "checked" : ""} />
              <span>${reason}</span>
            </label>
          `).join("")}
        </div>
      </div>
    </article>
  `;
}

function textView(question) {
  const isLast = isLastQuestion();
  return `
    <section class="screen narrow">
      ${progress()}
      <p class="eyebrow">Final read</p>
      <h2>${question.prompt}</h2>
      <textarea class="large-text" id="finalText" placeholder="Tell Cherri what to buy, tweak, or reject.">${participant.answers[question.id] || ""}</textarea>
      <button class="primary" ${isLast ? "data-complete" : "data-save-text"}>${isLast ? "Submit feedback" : "Continue"}</button>
    </section>
  `;
}

function completeView(campaign) {
  return `
    <section class="screen narrow success-card">
      <p class="eyebrow">Feedback received</p>
      <h1>Thank you, ${member.name}.</h1>
      <p class="lede">Your preview has been added to Cherri's decision dashboard. ${campaign.reward} will be marked for your Sunday Staples account.</p>
      <button class="primary" data-route="results">View results dashboard</button>
    </section>
  `;
}

function adminView() {
  const s = state();
  const campaign = getCampaign();
  adminDraft ||= structuredClone(campaign);
  return `
    <section class="screen">
      <div class="page-head">
        <div>
          <p class="eyebrow">Cherri's research builder</p>
          <h1>Build a focus group without code.</h1>
          <p class="lede">Upload or reference media, choose question types, preview the customer journey, and keep the data model ready for future brands.</p>
        </div>
        <button class="primary" data-save-campaign>Save campaign</button>
      </div>
      <div class="admin-workspace">
        <aside class="admin-sidebar" aria-label="Admin sections">
          ${adminTab("campaign", "Campaign Setup", "Audience, reward, status")}
          ${adminTab("survey", "Survey Logic", "Blocks, flow, questions")}
          ${adminTab("concepts", "Concept Library", "Select designs")}
          ${adminTab("uploads", "Upload Intake", "Add new media")}
          ${adminTab("publish", "Preview & Publish", "Readiness check")}
        </aside>
        <form class="panel form-stack admin-panel" data-admin-form>
          ${adminSectionView(s)}
        </form>
      </div>
    </section>
  `;
}

function adminTab(id, title, subtitle) {
  return `
    <button class="${adminSection === id ? "active" : ""}" data-admin-section="${id}" type="button">
      <strong>${title}</strong>
      <span>${subtitle}</span>
    </button>
  `;
}

function adminSectionView(s) {
  if (adminSection === "survey") return surveyAdminSection();
  if (adminSection === "concepts") return conceptsAdminSection(s);
  if (adminSection === "uploads") return uploadsAdminSection();
  if (adminSection === "publish") return publishAdminSection();
  return campaignAdminSection();
}

function campaignAdminSection() {
  return `
    <div class="section-kicker">Campaign Setup</div>
    <h2>Define the research room.</h2>
    <p class="hint">This is the high-level shell customers and internal teams will see around the survey.</p>
    <label>Campaign title<input name="title" value="${escapeAttr(adminDraft.title)}" /></label>
    <label>Audience<input name="audience" value="${escapeAttr(adminDraft.audience)}" /></label>
    <label>Reward<input name="reward" value="${escapeAttr(adminDraft.reward)}" /></label>
    <label>Status
      <select name="status"><option ${adminDraft.status === "draft" ? "selected" : ""}>draft</option><option ${adminDraft.status === "live" ? "selected" : ""}>live</option></select>
    </label>
    <div class="copy-editor-panel">
      <h3>Home Page Copy</h3>
      <p class="hint">Edit the first screen customers see after they enter the preview.</p>
      <label>Eyebrow<input name="homeEyebrow" value="${escapeAttr(adminDraft.homeCopy?.eyebrow || "")}" /></label>
      <label>Headline<input name="homeTitle" value="${escapeAttr(adminDraft.homeCopy?.title || "")}" /></label>
      <label>Intro body<textarea name="homeBody">${adminDraft.homeCopy?.body || ""}</textarea></label>
    </div>
  `;
}

function surveyAdminSection() {
  const uploaded = state().concepts.filter((concept) => concept.id.startsWith("upload-") || concept.category === "Uploaded Concept");
  const modules = researchModules(adminDraft);
  return `
    <div class="section-kicker">Survey Logic</div>
    <h2>Build the digital focus group.</h2>
    <p class="hint">Start with what happens in person: inspect samples, compare two platforms, explain buying intent, rank finalists, then decide buy, tweak, reject, or retest.</p>

    <div class="research-builder">
      <section class="blueprint-panel">
        ${researchGoal("Round 1", "Champion battle: two platforms, one winner stays, weaker samples rotate.")}
        ${researchGoal("Round 2", "Set ranking: customers rank sets of five shoes from weakest to strongest.")}
        ${researchGoal("Round 3", "No-budget aspiration: customers choose up to five dream picks from the full suite.")}
        ${researchGoal("Round 4", "Reason diagnosis: customers justify top selections from a structured reason pool.")}
      </section>
      ${researchQualityPanel()}

      <section class="media-intake-panel">
        <div class="logic-head">
          <div>
            <h3>Survey Media</h3>
            <p class="hint">Upload shoe photos, GIFs, or videos while building the survey. New files appear as thumbnails and are attached to this campaign.</p>
          </div>
        </div>
        ${uploadDropzone("logicConceptUpload")}
        <div class="uploaded-strip">
          ${uploaded.length ? uploaded.map(uploadedMediaThumb).join("") : `<p class="empty-note">No new media uploaded yet.</p>`}
        </div>
      </section>

      <section class="module-palette">
        <div class="logic-head">
          <div>
            <h3>Add Research Module</h3>
            <p class="hint">Choose the question patterns Sunday Staples actually needs. The system handles blocks and flow for you.</p>
          </div>
        </div>
        <div class="module-grid">
          <button type="button" class="module-option recommended" data-load-physical-template>
            <strong>Use 4-round focus group template</strong>
            <span>Builds the complete physical customer journey with best-practice wording.</span>
          </button>
          ${moduleCatalog().map((module) => `
            <button type="button" class="module-option" data-add-module="${module.id}">
              <strong>${module.label}</strong>
              <span>${module.description}</span>
            </button>
          `).join("")}
        </div>
      </section>

      <section>
        <div class="logic-head">
          <div>
            <h3>Research Path</h3>
            <p class="hint">This is the customer journey. Keep it short enough to feel premium, but complete enough to answer Cherri's ordering questions.</p>
          </div>
        </div>
        ${flowVisualisation(adminDraft)}
        <div class="module-list">
          ${modules.map(moduleEditor).join("")}
        </div>
      </section>

      <section class="rules-panel">
        <div>
          <h3>Rules</h3>
          <div class="rules-grid">
            <label class="switch-inline"><input data-rule-field="randomiseConcepts" type="checkbox" ${adminDraft.surveyDefinition.rules?.randomiseConcepts ? "checked" : ""} />Randomise concept order</label>
            <label class="switch-inline"><input data-rule-field="balanceLeftRight" type="checkbox" ${adminDraft.surveyDefinition.rules?.balanceLeftRight !== false ? "checked" : ""} />Balance left/right platforms</label>
            <label class="switch-inline"><input data-rule-field="requireReasons" type="checkbox" ${adminDraft.surveyDefinition.rules?.requireReasons ? "checked" : ""} />Require reasons on comparisons</label>
            <label>Target segment<input data-rule-field="targetSegment" value="${escapeAttr(adminDraft.surveyDefinition.rules?.targetSegment || "VIP customers in Singapore")}" /></label>
            <label>Max concepts per session<input data-rule-field="maxConcepts" type="number" min="2" value="${adminDraft.surveyDefinition.rules?.maxConcepts || adminDraft.conceptIds.length}" /></label>
            <label>Reward trigger
              <select data-rule-field="rewardTrigger">
                <option value="completion" ${adminDraft.surveyDefinition.rules?.rewardTrigger !== "approval" ? "selected" : ""}>On completion</option>
                <option value="approval" ${adminDraft.surveyDefinition.rules?.rewardTrigger === "approval" ? "selected" : ""}>After founder approval</option>
              </select>
            </label>
          </div>
        </div>
        <div>
          <h3>Decision Weights</h3>
          <div class="scoring-grid">
            <label>Pairwise<input data-score-field="pairwiseWeight" type="number" min="0" max="100" value="${adminDraft.surveyDefinition.scoring.pairwiseWeight}" /></label>
            <label>Buying intent<input data-score-field="buyingIntentWeight" type="number" min="0" max="100" value="${adminDraft.surveyDefinition.scoring.buyingIntentWeight}" /></label>
            <label>Ranking<input data-score-field="rankingWeight" type="number" min="0" max="100" value="${adminDraft.surveyDefinition.scoring.rankingWeight}" /></label>
            <label>Buy threshold<input data-score-field="buy" type="number" min="0" max="100" value="${adminDraft.surveyDefinition.scoring.thresholds.buy}" /></label>
            <label>Tweak threshold<input data-score-field="tweak" type="number" min="0" max="100" value="${adminDraft.surveyDefinition.scoring.thresholds.tweak}" /></label>
          </div>
        </div>
      </section>

      ${surveyModelSummary(adminDraft)}
    </div>
  `;
}

function researchGoal(title, body) {
  return `<article><strong>${title}</strong><span>${body}</span></article>`;
}

function researchQualityPanel() {
  return `
    <section class="quality-panel">
      <div>
        <h3>Research quality assessment</h3>
        <p class="hint">The physical flow is strong because it captures comparative choice, forced trade-offs, aspiration, and reasons. The improvements below make the data cleaner and less biased.</p>
      </div>
      <div class="quality-grid">
        ${qualityItem("Keep", "Head-to-head voting", "Excellent for exposing relative preference. Add balanced left/right placement and enough rotations so early shoes do not get unfair advantage.")}
        ${qualityItem("Improve", "Rank sets of five", "Use clear anchors: 5 = strongest purchase interest, 1 = weakest. Randomise set composition where possible.")}
        ${qualityItem("Keep", "No-budget aspiration", "Great for separating desire from affordability. Label it explicitly as aspiration, not purchase intent.")}
        ${qualityItem("Improve", "Reason pool", "Use multi-select reasons plus optional short text. Avoid leading reasons that make every shoe sound positive.")}
      </div>
    </section>
  `;
}

function qualityItem(tag, title, body) {
  return `<article><span>${tag}</span><strong>${title}</strong><p>${body}</p></article>`;
}

function flowVisualisation(campaign) {
  const blocks = campaign.surveyDefinition.blocks || [];
  const flow = campaign.surveyDefinition.flow || [];
  const questionsById = Object.fromEntries(campaign.questions.map((question) => [question.id, question]));
  return `
    <section class="flow-map" aria-label="Survey flow map">
      <div class="flow-primer">
        <div>
          <strong>Block</strong>
          <span>A block is a grouped moment in the focus group, like welcome, comparison, intent, or final ranking.</span>
        </div>
        <div>
          <strong>Survey flow</strong>
          <span>The flow is the route customers follow through those blocks from start to submission.</span>
        </div>
      </div>
      <div class="flow-rail">
        ${flow.map((step, index) => flowStepCard(step, index, blocks, questionsById)).join("")}
      </div>
    </section>
  `;
}

function flowStepCard(step, index, blocks, questionsById) {
  const blockId = step.type === "branch" ? step.then?.[0]?.ref : step.ref;
  const block = blocks.find((item) => item.id === blockId);
  const questions = (block?.questionIds || []).map((id) => questionsById[id]).filter(Boolean);
  return `
    <article class="flow-step-card">
      <div class="flow-step-number">${index + 1}</div>
      <div>
        <span>${step.type === "branch" ? "Conditional block" : "Block"}</span>
        <strong>${block?.title || blockId || "Missing block"}</strong>
        <p>${flowStepDescription(step, block, questions)}</p>
        <div class="flow-question-tags">
          ${questions.length ? questions.map((question) => `<em>${moduleLabelForQuestion(question)}</em>`).join("") : `<em>No questions assigned</em>`}
        </div>
      </div>
    </article>
  `;
}

function flowStepDescription(step, block, questions) {
  if (!block) return "This flow step needs a valid block before customers can reach it.";
  if (step.type === "branch") return `Shown when ${step.condition?.questionId || "a prior question"} is ${step.condition?.operator || "matched"}.`;
  if (questions.length === 1) return "Customer sees one focused research module in this moment.";
  return `Customer sees ${questions.length} grouped research modules in this moment.`;
}

function moduleLabelForQuestion(question) {
  if (question.type === "intro") return "Welcome";
  return question.module?.label || defaultModule(moduleTypeFromQuestion(question)).label || question.prompt || question.id;
}

function moduleCatalog() {
  return [
    { id: "champion-battle", label: "Round 1: Champion battle", description: "Two-platform head-to-head voting where winners stay and challengers rotate." },
    { id: "set-ranking", label: "Round 2: Rank set of five", description: "Rank a set from 1 to 5, with 5 as strongest purchase interest." },
    { id: "aspiration-pick", label: "Round 3: No-budget top five", description: "Choose up to five samples customers aspire toward most." },
    { id: "reason-diagnosis", label: "Round 4: Selection reasons", description: "Justify top selections using structured, reusable reason tags." },
    { id: "brand-fit", label: "Brand fit check", description: "Check whether the design feels aligned with Sunday Staples." },
    { id: "price", label: "Price test", description: "Test purchase interest at likely retail prices." },
    { id: "open", label: "Open feedback", description: "Let customers tell Cherri what they would improve." }
  ];
}

function researchModules(campaign) {
  return campaign.questions
    .filter((question) => question.type !== "intro")
    .map((question, index) => ({
      ...defaultModule(moduleTypeFromQuestion(question), campaign),
      ...question.module,
      questionId: question.id,
      type: moduleTypeFromQuestion(question),
      prompt: question.prompt || question.module?.prompt || "",
      required: Boolean(question.required),
      index
    }));
}

function moduleTypeFromQuestion(question) {
  if (question.module?.type) return question.module.type;
  if (question.type === "pairwise") return "champion-battle";
  if (question.id.includes("buying")) return "buying-intent";
  if (question.id.includes("ranking")) return "ranking";
  if (question.id.includes("colour") || question.id.includes("color")) return "colour";
  if (question.type === "choice") return "tweak";
  if (question.type === "text") return "open";
  return question.type;
}

function defaultModule(type, campaign = adminDraft) {
  const conceptIds = campaign?.conceptIds || [];
  const defaults = {
    "champion-battle": {
      label: "Round 1: Champion battle",
      prompt: "Two shoes are on the platforms. Which one would you choose to stay in the room?",
      questionType: "pairwise",
      collectReason: true,
      collectDrivers: true,
      conceptIds
    },
    "set-ranking": {
      label: "Round 2: Rank set of five",
      prompt: "Rank this set of five shoes. Give 5 to the strongest purchase candidate and 1 to the weakest.",
      questionType: "ranking",
      conceptIds: conceptIds.slice(0, 5)
    },
    "aspiration-pick": {
      label: "Round 3: No-budget top five",
      prompt: "If money was not a concern, which five pairs would you most aspire to own?",
      questionType: "multi-select",
      maxSelections: 5,
      conceptIds
    },
    "reason-diagnosis": {
      label: "Round 4: Selection reasons",
      prompt: "For your strongest selections, what made them stand out?",
      questionType: "reason-pool",
      reasons: defaultReasonPool(),
      sourceQuestionType: "aspiration-pick",
      conceptIds
    },
    "buying-intent": {
      label: "Buying intent score",
      prompt: "How strong is your buying intent for each design?",
      questionType: "rating",
      scale: ["Pass", "Curious", "Would try", "Likely buy", "Need this"],
      conceptIds
    },
    "brand-fit": {
      label: "Sunday Staples fit",
      prompt: "How well does each design fit Sunday Staples?",
      questionType: "rating",
      scale: ["Not us", "Maybe", "On brand", "Very Sunday Staples", "Signature potential"],
      conceptIds
    },
    comfort: {
      label: "Comfort expectation",
      prompt: "How comfortable do you expect this design to feel?",
      questionType: "rating",
      scale: ["Unsure", "Low", "Moderate", "High", "Cloud-level"],
      conceptIds
    },
    colour: {
      label: "Colourway vote",
      prompt: "Which colour direction feels most Sunday Staples?",
      questionType: "choice",
      options: ["Cream", "Nude", "Black", "Blush", "Sage", "Light Blue"]
    },
    price: {
      label: "Price test",
      prompt: "What price would still feel like a yes?",
      questionType: "choice",
      options: ["$129", "$149", "$169", "$189", "Only with promo"]
    },
    tweak: {
      label: "Tweak selector",
      prompt: "What should be tweaked before Sunday Staples places the order?",
      questionType: "choice",
      options: ["Colour", "Material", "Toe shape", "Heel height", "Strap", "Comfort lining", "Reject design"]
    },
    ranking: {
      label: "Final ranking",
      prompt: "Rank the finalists from strongest to weakest for Sunday Staples.",
      questionType: "ranking",
      conceptIds
    },
    open: {
      label: "Open feedback",
      prompt: "What would you tell Cherri about this shortlist?",
      questionType: "text",
      validation: { maxLength: 600 }
    }
  };
  return defaults[type] || defaults.open;
}

function defaultReasonPool() {
  return [
    "Suits my taste",
    "Most mileage for me",
    "Looks the most comfortable",
    "Perfect for everyday needs",
    "Extremely attractive to me",
    "Feels premium",
    "Easy to match with outfits",
    "Suitable for work",
    "Suitable for weekends",
    "Looks unique but wearable",
    "Good travel shoe",
    "Would replace something I already own",
    "I would wait for this launch",
    "I would recommend this to a friend"
  ];
}

function moduleEditor(module, index) {
  const definition = moduleCatalog().find((item) => item.id === module.type) || { label: module.label, description: "" };
  return `
    <article class="research-module" data-module-index="${index}">
      <div class="module-head">
        <div>
          <span>Step ${index + 1}</span>
          <h3>${definition.label}</h3>
          <p>${definition.description}</p>
        </div>
        <div class="module-actions">
          <button type="button" data-move-module="${index}" data-dir="-1" ${index === 0 ? "disabled" : ""}>Up</button>
          <button type="button" data-move-module="${index}" data-dir="1">Down</button>
          <button type="button" data-remove-module="${index}">Remove</button>
        </div>
      </div>
      <input type="hidden" data-module-field="type" value="${module.type}" />
      <label>Question prompt<input data-module-field="prompt" value="${escapeAttr(module.prompt)}" /></label>
      <div class="module-config-grid">
        <label class="switch-inline"><input data-module-field="required" type="checkbox" ${module.required ? "checked" : ""} />Required</label>
        <label class="switch-inline"><input data-module-field="collectReason" type="checkbox" ${module.collectReason ? "checked" : ""} />Ask why</label>
        <label class="switch-inline"><input data-module-field="collectDrivers" type="checkbox" ${module.collectDrivers ? "checked" : ""} />Capture drivers</label>
      </div>
      ${moduleOptionEditor(module)}
      ${moduleConceptSelector(module)}
    </article>
  `;
}

function moduleOptionEditor(module) {
  if (!["choice", "price", "tweak", "colour"].includes(module.questionType) && !module.options && !module.reasons) {
    if (!module.scale) return "";
  }
  const label = module.reasons ? "Reason pool" : module.scale ? "Scale labels" : "Choice options";
  const field = module.reasons ? "reasons" : module.scale ? "scale" : "options";
  const values = module.reasons || module.scale || module.options || [];
  return `<label>${label}<input data-module-field="${field}" value="${escapeAttr(values.join(", "))}" /></label>`;
}

function moduleConceptSelector(module) {
  if (!["champion-battle", "set-ranking", "aspiration-pick", "reason-diagnosis", "buying-intent", "brand-fit", "comfort", "ranking"].includes(module.type)) return "";
  const concepts = state().concepts.filter((concept) => adminDraft.conceptIds.includes(concept.id));
  return `
    <div>
      <p class="hint">Concepts included in this module</p>
      <div class="mini-concept-grid">
        ${concepts.map((concept) => `
          <label class="mini-concept">
            <input data-module-concept type="checkbox" value="${concept.id}" ${(module.conceptIds || adminDraft.conceptIds).includes(concept.id) ? "checked" : ""} />
            ${mediaElement(concept)}
            <span>${concept.name}</span>
          </label>
        `).join("")}
      </div>
    </div>
  `;
}

function conceptsAdminSection(s) {
  return `
    <div class="section-kicker">Concept Library</div>
    <h2>Select the designs in this campaign.</h2>
    <p class="hint">Edit concept names and factory metadata here. These details flow into the customer preview, survey modules, and results dashboard.</p>
    <div class="editable-concept-list">
      ${s.concepts.map((concept) => `
        <article class="editable-concept-card" data-concept-editor="${concept.id}">
          ${mediaElement(concept)}
          <div class="concept-edit-fields">
            <label class="switch-inline"><input data-concept-include type="checkbox" value="${concept.id}" ${adminDraft.conceptIds.includes(concept.id) ? "checked" : ""} />Include in campaign</label>
            <label>Factory code<input data-concept-field="factoryCode" value="${escapeAttr(concept.factoryCode)}" /></label>
            <label>Concept name<input data-concept-field="name" value="${escapeAttr(concept.name)}" /></label>
            <div class="concept-field-row">
              <label>Category<input data-concept-field="category" value="${escapeAttr(concept.category)}" /></label>
              <label>Material<input data-concept-field="material" value="${escapeAttr(concept.material)}" /></label>
              <label>Price band<input data-concept-field="priceBand" value="${escapeAttr(concept.priceBand)}" /></label>
            </div>
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function uploadsAdminSection() {
  return `
    <div class="section-kicker">Upload Intake</div>
    <h2>Add new shoe designs and concepts.</h2>
    <p class="hint">Uploaded files become new Sunday Staples concept records and are automatically attached to the active campaign.</p>
    ${uploadDropzone("conceptUpload")}
  `;
}

function uploadDropzone(id) {
  return `
    <div class="upload-zone" data-upload-zone>
      <input id="${id}" data-concept-upload type="file" accept="image/*,.gif,video/*" multiple />
      <label for="${id}">
        <strong>Upload new shoe concepts</strong>
        <span>Click to choose files or drag photos, GIFs, and short videos here.</span>
      </label>
    </div>
  `;
}

function uploadedMediaThumb(concept) {
  return `
    <article class="uploaded-thumb">
      ${mediaElement(concept)}
      <div>
        <strong>${concept.name}</strong>
        <span>${concept.media[0].fileName || concept.factoryCode}</span>
      </div>
    </article>
  `;
}

function publishAdminSection() {
  const selectedCount = adminDraft.conceptIds.length;
  const questionCount = adminDraft.questions.length;
  const quotaCount = adminDraft.surveyDefinition?.quotas?.length || 0;
  return `
    <div class="section-kicker">Preview & Publish</div>
    <h2>Review campaign readiness.</h2>
    <p class="hint">A practical check before sending this to Sunday Staples customers.</p>
    <div class="readiness-grid">
      <div><strong>${selectedCount}</strong><span>Selected concepts</span></div>
      <div><strong>${questionCount}</strong><span>Questions</span></div>
      <div><strong>${quotaCount}</strong><span>Segment quotas</span></div>
      <div><strong>${adminDraft.status}</strong><span>Status</span></div>
    </div>
    <button type="button" class="secondary" data-route="member">Open customer preview</button>
  `;
}

function surveyQuestions(campaign) {
  const byId = Object.fromEntries(campaign.questions.map((question) => [question.id, question]));
  const ordered = [];
  campaign.surveyDefinition.flow.forEach((step) => {
    if (step.type === "block") pushBlockQuestions(step.ref);
    if (step.type === "branch" && evaluateBranch(step.condition, campaign)) {
      (step.then || []).forEach((branchStep) => {
        if (branchStep.type === "block") pushBlockQuestions(branchStep.ref);
      });
    }
  });
  campaign.questions.forEach((question) => {
    if (!ordered.some((item) => item.id === question.id)) ordered.push(question);
  });
  return ordered.filter((question) => displayQuestion(question, campaign));

  function pushBlockQuestions(blockId) {
    const block = campaign.surveyDefinition.blocks.find((item) => item.id === blockId);
    (block?.questionIds || []).forEach((id) => {
      if (byId[id]) ordered.push(byId[id]);
    });
  }
}

function evaluateBranch(condition, campaign) {
  if (!condition) return true;
  if (condition.operator === "answered") return Boolean(participant.answers[condition.questionId]);
  if (condition.operator === "always") return true;
  return true;
}

function displayQuestion(question, campaign) {
  const logic = question.displayLogic;
  if (!logic) return true;
  if (logic.source === "campaign.conceptIds" && logic.operator === "count_gte") {
    return campaign.conceptIds.length >= Number(logic.value);
  }
  return true;
}

function surveyModelSummary(campaign) {
  const definition = campaign.surveyDefinition || normaliseCampaign(campaign).surveyDefinition;
  const diagnostics = surveyDiagnostics(campaign);
  return `
    <section class="survey-model">
      <div><strong>${definition.blocks.length}</strong><span>Blocks</span></div>
      <div><strong>${definition.flow.length}</strong><span>Flow steps</span></div>
      <div><strong>${definition.quotas.length}</strong><span>Quotas</span></div>
      <div><strong>${definition.embeddedData.length}</strong><span>Embedded data</span></div>
      <p>Backend model: blocks, branch logic, display rules, validation, scoring weights, quotas, and export fields.</p>
      <div class="${diagnostics.length ? "diagnostics warn" : "diagnostics ok"}">
        <strong>${diagnostics.length ? `${diagnostics.length} issue${diagnostics.length === 1 ? "" : "s"}` : "Ready"}</strong>
        <span>${diagnostics.length ? diagnostics.join(" ") : "Survey flow and scoring controls are internally consistent."}</span>
      </div>
    </section>
  `;
}

function surveyDiagnostics(campaign) {
  const definition = campaign.surveyDefinition;
  const blockIds = new Set(definition.blocks.map((block) => block.id));
  const questionIds = new Set(campaign.questions.map((question) => question.id));
  const issues = [];
  definition.flow.forEach((step) => {
    const ref = step.type === "branch" ? step.then?.[0]?.ref : step.ref;
    if (ref && !blockIds.has(ref)) issues.push(`Flow references missing block "${ref}".`);
    if (step.type === "branch" && step.condition?.operator === "answered" && !questionIds.has(step.condition.questionId)) {
      issues.push(`Branch checks missing question "${step.condition.questionId}".`);
    }
  });
  definition.blocks.forEach((block) => {
    block.questionIds.forEach((id) => {
      if (!questionIds.has(id)) issues.push(`Block "${block.id}" contains missing question "${id}".`);
    });
  });
  const weights = definition.scoring.pairwiseWeight + definition.scoring.buyingIntentWeight + definition.scoring.rankingWeight + (definition.scoring.aspirationWeight || 0) + (definition.scoring.reasonWeight || 0);
  if (weights !== 100) issues.push(`Scoring weights total ${weights}, not 100.`);
  return issues;
}

function questionEditor(question, index) {
  const selectedBlockIds = adminDraft.surveyDefinition.blocks
    .filter((block) => block.questionIds.includes(question.id))
    .map((block) => block.id);
  return `
    <article class="logic-card question-card" data-question-index="${index}">
      <div class="logic-card-head">
        <strong>${question.id}</strong>
        <button type="button" data-remove-question="${index}" aria-label="Remove question">Remove</button>
      </div>
      <div class="logic-row">
        <label>Type
          <select data-question-field="type">
            ${["intro", "pairwise", "rating", "ranking", "choice", "text"].map((type) => `<option ${question.type === type ? "selected" : ""}>${type}</option>`).join("")}
          </select>
        </label>
        <label>Analytics key<input data-question-field="analyticsKey" value="${escapeAttr(question.analyticsKey)}" /></label>
        <label class="switch-inline"><input data-question-field="required" type="checkbox" ${question.required ? "checked" : ""} />Required</label>
      </div>
      <label>Prompt<input data-question-field="prompt" value="${escapeAttr(question.prompt || question.title || "")}" /></label>
      <div class="logic-row">
        <label>Display source
          <select data-question-field="displaySource">
            <option value="">Always show</option>
            <option value="campaign.conceptIds" ${question.displayLogic?.source === "campaign.conceptIds" ? "selected" : ""}>Campaign concept count</option>
          </select>
        </label>
        <label>Operator
          <select data-question-field="displayOperator">
            <option value="count_gte" ${question.displayLogic?.operator === "count_gte" ? "selected" : ""}>count is at least</option>
          </select>
        </label>
        <label>Value<input data-question-field="displayValue" type="number" value="${question.displayLogic?.value || ""}" /></label>
      </div>
      <div class="logic-row">
        <label>Max text length<input data-question-field="maxLength" type="number" value="${question.validation?.maxLength || ""}" /></label>
        <label>Included in blocks<input data-question-field="blocks" value="${escapeAttr(selectedBlockIds.join(", "))}" placeholder="welcome-block, intent-block" /></label>
      </div>
    </article>
  `;
}

function blockEditor(block, index) {
  return `
    <article class="logic-card" data-block-index="${index}">
      <div class="logic-card-head">
        <strong>Block ${index + 1}</strong>
        <button type="button" data-remove-block="${index}">Remove</button>
      </div>
      <div class="logic-row">
        <label>Block ID<input data-block-field="id" value="${escapeAttr(block.id)}" /></label>
        <label>Title<input data-block-field="title" value="${escapeAttr(block.title)}" /></label>
      </div>
      <label>Question IDs<input data-block-field="questionIds" value="${escapeAttr(block.questionIds.join(", "))}" /></label>
      <div class="logic-row">
        <label>Randomisation
          <select data-block-field="randomisationMode">
            ${["none", "randomize_questions", "randomize_pairs"].map((mode) => `<option value="${mode}" ${block.randomisation?.mode === mode ? "selected" : ""}>${mode}</option>`).join("")}
          </select>
        </label>
        <label class="switch-inline"><input data-block-field="balanceLeftRight" type="checkbox" ${block.randomisation?.balanceLeftRight ? "checked" : ""} />Balance left/right</label>
      </div>
    </article>
  `;
}

function flowEditor(step, index) {
  return `
    <article class="logic-card" data-flow-index="${index}">
      <div class="logic-card-head">
        <strong>Step ${index + 1}</strong>
        <button type="button" data-remove-flow="${index}">Remove</button>
      </div>
      <div class="logic-row">
        <label>Step type
          <select data-flow-field="type">
            <option value="block" ${step.type === "block" ? "selected" : ""}>block</option>
            <option value="branch" ${step.type === "branch" ? "selected" : ""}>branch</option>
          </select>
        </label>
        <label>Block reference<input data-flow-field="ref" value="${escapeAttr(step.ref || step.then?.[0]?.ref || "")}" /></label>
      </div>
      <div class="logic-row">
        <label>Branch label<input data-flow-field="label" value="${escapeAttr(step.label || "")}" /></label>
        <label>Condition question<input data-flow-field="conditionQuestion" value="${escapeAttr(step.condition?.questionId || "")}" /></label>
        <label>Condition operator
          <select data-flow-field="conditionOperator">
            <option value="answered" ${step.condition?.operator === "answered" ? "selected" : ""}>answered</option>
            <option value="always" ${step.condition?.operator === "always" ? "selected" : ""}>always</option>
          </select>
        </label>
      </div>
    </article>
  `;
}

function embeddedDataEditor(item, index) {
  return `
    <article class="logic-card compact-card" data-embedded-index="${index}">
      <input data-embedded-field="key" value="${escapeAttr(item.key)}" placeholder="key" />
      <input data-embedded-field="value" value="${escapeAttr(item.value)}" placeholder="value" />
      <button type="button" data-remove-embedded="${index}">Remove</button>
    </article>
  `;
}

function quotaEditor(item, index) {
  return `
    <article class="logic-card compact-card" data-quota-index="${index}">
      <input data-quota-field="id" value="${escapeAttr(item.id)}" placeholder="quota-id" />
      <input data-quota-field="segment" value="${escapeAttr(item.segment)}" placeholder="segment" />
      <input data-quota-field="targetResponses" type="number" min="0" value="${item.targetResponses}" />
      <button type="button" data-remove-quota="${index}">Remove</button>
    </article>
  `;
}

function resultsView() {
  const campaign = getCampaign();
  const rows = scoreConcepts(campaign);
  return `
    <section class="screen">
      <div class="page-head">
        <div>
          <p class="eyebrow">Factory order intelligence</p>
          <h1>Buy, tweak, or reject with evidence.</h1>
          <p class="lede">${state().responses.filter((item) => item.campaignId === campaign.id).length} responses collected for ${campaign.title}.</p>
        </div>
        <button class="secondary" data-export>Export JSON</button>
      </div>
      <div class="decision-grid">
        ${rows.map(resultCard).join("")}
      </div>
      <div class="panel">
        <h2>Segment read</h2>
        <div class="segment-grid">
          ${segmentRows(campaign).join("")}
        </div>
      </div>
    </section>
  `;
}

function scoreConcepts(campaign) {
  const responses = state().responses.filter((item) => item.campaignId === campaign.id);
  const scoring = campaign.surveyDefinition.scoring;
  return conceptsFor(campaign).map((concept) => {
    let wins = 0;
    let battles = 0;
    let rating = 0;
    let ratingCount = 0;
    let rank = 0;
    let aspiration = 0;
    let reasonMentions = 0;
    responses.forEach((item) => {
      (item.answers["battle-1"] || []).forEach((battle) => {
        if (battle.left === concept.id || battle.right === concept.id) battles += 1;
        if (battle.winner === concept.id) wins += 1;
      });
      Object.values(item.answers || {}).forEach((answer) => {
        if (Array.isArray(answer) && answer.includes(concept.id)) aspiration += 1;
        if (answer?.[concept.id] && Array.isArray(answer[concept.id])) reasonMentions += answer[concept.id].length;
      });
      const intent = item.answers["buying-intent"]?.[concept.id];
      if (intent) {
        rating += Number(intent);
        ratingCount += 1;
      }
      const rankIndex = item.answers.ranking?.indexOf(concept.id);
      if (rankIndex >= 0) rank += campaign.conceptIds.length - rankIndex;
    });
    const winRate = battles ? wins / battles : 0;
    const intentAvg = ratingCount ? rating / ratingCount : 0;
    const aspirationRate = responses.length ? aspiration / responses.length : 0;
    const reasonRate = responses.length ? Math.min(1, reasonMentions / (responses.length * 4)) : 0;
    const score = Math.round((
      winRate * scoring.pairwiseWeight +
      (intentAvg / 5) * scoring.buyingIntentWeight +
      (rank / Math.max(1, responses.length * campaign.conceptIds.length)) * scoring.rankingWeight +
      aspirationRate * (scoring.aspirationWeight || 0) +
      reasonRate * (scoring.reasonWeight || 0)
    ) * 100) / 100;
    return { concept, wins, battles, winRate, intentAvg, score, decision: decisionFor(score, intentAvg, winRate) };
  }).sort((a, b) => b.score - a.score);
}

function decisionFor(score, intent, winRate) {
  const thresholds = getCampaign().surveyDefinition.scoring.thresholds;
  if (score >= thresholds.buy && intent >= 4) return "Buy";
  if (score >= thresholds.tweak || winRate >= 0.5) return "Tweak";
  return "Reject";
}

function resultCard(row) {
  return `
    <article class="result-card ${row.decision.toLowerCase()}">
      ${mediaElement(row.concept)}
      <div>
        <span>${row.decision}</span>
        <h3>${row.concept.name}</h3>
        <p>${row.concept.factoryCode} · ${row.concept.colorway}</p>
      </div>
      <dl>
        <div><dt>Score</dt><dd>${row.score}</dd></div>
        <div><dt>Win rate</dt><dd>${Math.round(row.winRate * 100)}%</dd></div>
        <div><dt>Intent</dt><dd>${row.intentAvg.toFixed(1)}/5</dd></div>
      </dl>
    </article>
  `;
}

function segmentRows(campaign) {
  const responses = state().responses.filter((item) => item.campaignId === campaign.id);
  const groups = [...new Set(responses.map((item) => item.member.segment))];
  return groups.map((segment) => {
    const count = responses.filter((item) => item.member.segment === segment).length;
    return `<div><strong>${segment}</strong><span>${count} response${count === 1 ? "" : "s"}</span><p>${topPickForSegment(segment, responses)}</p></div>`;
  });
}

function topPickForSegment(segment, responses) {
  const picks = {};
  responses.filter((item) => item.member.segment === segment).forEach((item) => {
    const top = item.answers.ranking?.[0];
    if (top) picks[top] = (picks[top] || 0) + 1;
  });
  const top = Object.entries(picks).sort((a, b) => b[1] - a[1])[0]?.[0];
  return top ? `Top pick: ${findConcept(top).name}` : "No top pick yet";
}

function productCard(concept, action) {
  return `
    <article class="product-card">
      ${mediaElement(concept)}
      <div>
        <p class="eyebrow">${concept.factoryCode}</p>
        <h3>${concept.name}</h3>
        <p>${concept.category} · ${concept.material} · ${concept.priceBand}</p>
        <button class="primary" data-pick="${concept.id}">${action}</button>
      </div>
    </article>
  `;
}

function conceptTile(concept) {
  return `<article>${mediaElement(concept)}<strong>${concept.name}</strong></article>`;
}

function rankRow(concept, index) {
  return `
    <article class="rank-row">
      <span>${index + 1}</span>
      ${mediaElement(concept)}
      <strong>${concept.name}</strong>
      <div>
        <button data-rank="${index}" data-dir="-1" ${index === 0 ? "disabled" : ""}>Up</button>
        <button data-rank="${index}" data-dir="1" ${index === participant.ranking.length - 1 ? "disabled" : ""}>Down</button>
      </div>
    </article>
  `;
}

function progress() {
  const campaign = getCampaign();
  const questions = surveyQuestions(campaign);
  const percent = Math.round((participant.step / Math.max(1, questions.length - 1)) * 100);
  return `<div class="progress" aria-label="Progress"><span style="width:${percent}%"></span></div>`;
}

function mediaElement(concept) {
  const media = concept.media[0];
  if (media.type === "video") {
    return `<video src="${media.url}" aria-label="${escapeAttr(media.alt)}" muted playsinline loop></video>`;
  }
  return `<img src="${media.url}" alt="${escapeAttr(media.alt)}" />`;
}

function bindEvents() {
  document.querySelectorAll("[data-route]").forEach((button) => {
    button.addEventListener("click", () => {
      route = button.dataset.route;
      render();
    });
  });

  document.querySelectorAll("[data-admin-section]").forEach((button) => {
    button.addEventListener("click", () => {
      persistVisibleAdminFields();
      adminSection = button.dataset.adminSection;
      render();
    });
  });

  document.querySelector("[data-action='login']")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const email = new FormData(event.currentTarget).get("email").toLowerCase();
    member = config.members.find((item) => item.email === email) || { email, name: "Inner Circle Member", tier: "Guest Pilot", segment: "Guest" };
    member.ageRange = new FormData(event.currentTarget).get("ageRange");
    participant = freshParticipant();
    render();
  });

  document.querySelector("[data-next]")?.addEventListener("click", nextStep);

  document.querySelectorAll("[data-pick]").forEach((button) => {
    button.addEventListener("click", () => {
      const campaign = getCampaign();
      const question = surveyQuestions(campaign)[participant.step];
      const pair = question.pairs[participant.pairIndex];
      const answer = {
        left: pair[0],
        right: pair[1],
        winner: button.dataset.pick,
        reason: document.querySelector("#pairReason")?.value.trim() || "",
        drivers: [...document.querySelectorAll(".chips input:checked")].map((item) => item.value)
      };
      participant.answers[question.id] ||= [];
      participant.answers[question.id].push(answer);
      if (participant.pairIndex + 1 < question.pairs.length) participant.pairIndex += 1;
      else nextStep();
      render();
    });
  });

  document.querySelector("[data-save-rating]")?.addEventListener("click", () => {
    const question = surveyQuestions(getCampaign())[participant.step];
    participant.answers[question.id] = Object.fromEntries([...document.querySelectorAll("[data-rating]")].map((row) => [row.dataset.rating, Number(row.querySelector("select").value)]));
    nextStep();
  });

  document.querySelectorAll("[data-rank]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.rank);
      const dir = Number(button.dataset.dir);
      const next = index + dir;
      const ranking = participant.ranking;
      [ranking[index], ranking[next]] = [ranking[next], ranking[index]];
      render();
    });
  });

  document.querySelectorAll("[data-choice]").forEach((button) => {
    button.addEventListener("click", () => {
      const question = surveyQuestions(getCampaign())[participant.step];
      participant.answers[question.id] = button.dataset.choice;
      nextStep();
    });
  });

  document.querySelectorAll("[data-multi-pick]").forEach((button) => {
    button.addEventListener("click", () => {
      const question = surveyQuestions(getCampaign())[participant.step];
      const max = question.maxSelections || question.module?.maxSelections || 5;
      participant.answers[question.id] ||= [];
      const selected = participant.answers[question.id];
      const index = selected.indexOf(button.dataset.multiPick);
      if (index >= 0) selected.splice(index, 1);
      else if (selected.length < max) selected.push(button.dataset.multiPick);
      render();
    });
  });

  document.querySelector("[data-save-reasons]")?.addEventListener("click", () => {
    const question = surveyQuestions(getCampaign())[participant.step];
    participant.answers[question.id] = Object.fromEntries([...document.querySelectorAll("[data-reason-concept]")].map((card) => [
      card.dataset.reasonConcept,
      [...card.querySelectorAll("input:checked")].map((input) => input.value)
    ]));
    nextStep();
  });

  document.querySelector("[data-complete]")?.addEventListener("click", () => {
    const question = surveyQuestions(getCampaign())[participant.step];
    participant.answers[question.id] = document.querySelector("#finalText").value.trim();
    completeParticipant();
  });

  document.querySelector("[data-save-text]")?.addEventListener("click", () => {
    const question = surveyQuestions(getCampaign())[participant.step];
    participant.answers[question.id] = document.querySelector("#finalText").value.trim();
    nextStep();
  });

  document.querySelector("[data-add-question]")?.addEventListener("click", () => {
    persistVisibleAdminFields();
    adminDraft.questions.push({ id: `custom-${Date.now()}`, type: "text", prompt: "What should Cherri know?" });
    const lastBlock = adminDraft.surveyDefinition.blocks.at(-1);
    if (lastBlock) lastBlock.questionIds.push(adminDraft.questions.at(-1).id);
    render();
  });

  document.querySelectorAll("[data-remove-question]").forEach((button) => {
    button.addEventListener("click", () => {
      persistVisibleAdminFields();
      const removed = adminDraft.questions[Number(button.dataset.removeQuestion)];
      adminDraft.questions.splice(Number(button.dataset.removeQuestion), 1);
      adminDraft.surveyDefinition.blocks.forEach((block) => {
        block.questionIds = block.questionIds.filter((id) => id !== removed?.id);
      });
      render();
    });
  });

  document.querySelectorAll("[data-add-module]").forEach((button) => {
    button.addEventListener("click", () => {
      persistVisibleAdminFields();
      addResearchModule(button.dataset.addModule);
      render();
    });
  });

  document.querySelector("[data-load-physical-template]")?.addEventListener("click", () => {
    persistVisibleAdminFields();
    applyPhysicalFocusGroupTemplate();
    render();
  });

  document.querySelectorAll("[data-remove-module]").forEach((button) => {
    button.addEventListener("click", () => {
      persistVisibleAdminFields();
      const modules = researchModules(adminDraft);
      modules.splice(Number(button.dataset.removeModule), 1);
      applyResearchModules(modules);
      render();
    });
  });

  document.querySelectorAll("[data-move-module]").forEach((button) => {
    button.addEventListener("click", () => {
      persistVisibleAdminFields();
      const index = Number(button.dataset.moveModule);
      const nextIndex = index + Number(button.dataset.dir);
      const modules = researchModules(adminDraft);
      if (nextIndex < 0 || nextIndex >= modules.length) return;
      [modules[index], modules[nextIndex]] = [modules[nextIndex], modules[index]];
      applyResearchModules(modules);
      render();
    });
  });

  document.querySelector("[data-add-block]")?.addEventListener("click", () => {
    persistVisibleAdminFields();
    const id = `block-${Date.now()}`;
    adminDraft.surveyDefinition.blocks.push({ id, title: "New block", questionIds: [], randomisation: { mode: "none", balanceLeftRight: false } });
    render();
  });

  document.querySelectorAll("[data-remove-block]").forEach((button) => {
    button.addEventListener("click", () => {
      persistVisibleAdminFields();
      const removed = adminDraft.surveyDefinition.blocks[Number(button.dataset.removeBlock)];
      adminDraft.surveyDefinition.blocks.splice(Number(button.dataset.removeBlock), 1);
      adminDraft.surveyDefinition.flow = adminDraft.surveyDefinition.flow.filter((step) => step.ref !== removed?.id && step.then?.[0]?.ref !== removed?.id);
      render();
    });
  });

  document.querySelector("[data-add-flow-block]")?.addEventListener("click", () => {
    persistVisibleAdminFields();
    const firstBlock = adminDraft.surveyDefinition.blocks[0]?.id || "";
    adminDraft.surveyDefinition.flow.push({ type: "block", ref: firstBlock });
    render();
  });

  document.querySelectorAll("[data-remove-flow]").forEach((button) => {
    button.addEventListener("click", () => {
      persistVisibleAdminFields();
      adminDraft.surveyDefinition.flow.splice(Number(button.dataset.removeFlow), 1);
      render();
    });
  });

  document.querySelector("[data-add-embedded-data]")?.addEventListener("click", () => {
    persistVisibleAdminFields();
    adminDraft.surveyDefinition.embeddedData.push({ key: "newField", value: "" });
    render();
  });

  document.querySelectorAll("[data-remove-embedded]").forEach((button) => {
    button.addEventListener("click", () => {
      persistVisibleAdminFields();
      adminDraft.surveyDefinition.embeddedData.splice(Number(button.dataset.removeEmbedded), 1);
      render();
    });
  });

  document.querySelector("[data-add-quota]")?.addEventListener("click", () => {
    persistVisibleAdminFields();
    adminDraft.surveyDefinition.quotas.push({ id: `quota-${Date.now()}`, segment: "VIP", targetResponses: 25 });
    render();
  });

  document.querySelectorAll("[data-remove-quota]").forEach((button) => {
    button.addEventListener("click", () => {
      persistVisibleAdminFields();
      adminDraft.surveyDefinition.quotas.splice(Number(button.dataset.removeQuota), 1);
      render();
    });
  });

  document.querySelector("[data-save-campaign]")?.addEventListener("click", () => {
    persistVisibleAdminFields();
    const next = readState();
    next.campaigns = next.campaigns.map((campaign) => campaign.id === adminDraft.id ? structuredClone(adminDraft) : campaign);
    writeState(next);
    participant = freshParticipant();
    render();
  });

  document.querySelectorAll("[data-concept-upload]").forEach((uploadInput) => {
    uploadInput.addEventListener("change", () => importConceptFiles([...uploadInput.files]));
  });
  document.querySelectorAll("[data-upload-zone]").forEach((uploadZone) => {
    uploadZone.addEventListener("dragover", (event) => {
      event.preventDefault();
      uploadZone.classList.add("is-dragging");
    });
    uploadZone.addEventListener("dragleave", () => uploadZone.classList.remove("is-dragging"));
    uploadZone.addEventListener("drop", (event) => {
      event.preventDefault();
      uploadZone.classList.remove("is-dragging");
      importConceptFiles([...event.dataTransfer.files]);
    });
  });

  document.querySelector("[data-export]")?.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(readState(), null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "sunday-staples-inner-circle-export.json";
    link.click();
    URL.revokeObjectURL(link.href);
  });
}

function persistVisibleAdminFields() {
  const form = document.querySelector("[data-admin-form]");
  if (!form || !adminDraft) return;
  const data = new FormData(form);
  if (data.has("title")) adminDraft.title = data.get("title");
  if (data.has("audience")) adminDraft.audience = data.get("audience");
  if (data.has("reward")) adminDraft.reward = data.get("reward");
  if (data.has("status")) adminDraft.status = data.get("status");
  if (data.has("homeEyebrow") || data.has("homeTitle") || data.has("homeBody")) {
    adminDraft.homeCopy = {
      eyebrow: data.get("homeEyebrow") || "",
      title: data.get("homeTitle") || "",
      body: data.get("homeBody") || ""
    };
    const intro = adminDraft.questions.find((question) => question.type === "intro");
    if (intro) {
      intro.eyebrow = adminDraft.homeCopy.eyebrow;
      intro.title = adminDraft.homeCopy.title;
      intro.body = adminDraft.homeCopy.body;
    }
  }
  const checkedConcepts = [...document.querySelectorAll(".library-card input:checked")].map((input) => input.value);
  const editableCheckedConcepts = [...document.querySelectorAll("[data-concept-include]:checked")].map((input) => input.value);
  if (editableCheckedConcepts.length || adminSection === "concepts") adminDraft.conceptIds = editableCheckedConcepts;
  else if (checkedConcepts.length) adminDraft.conceptIds = checkedConcepts;
  persistConceptEdits();
  persistSurveyDefinitionFields();
}

function persistConceptEdits() {
  const rows = [...document.querySelectorAll("[data-concept-editor]")];
  if (!rows.length) return;
  const next = readState();
  next.conceptEdits ||= {};
  rows.forEach((row) => {
    const id = row.dataset.conceptEditor;
    const field = (name) => row.querySelector(`[data-concept-field="${name}"]`)?.value.trim();
    next.conceptEdits[id] = {
      ...(next.conceptEdits[id] || {}),
      factoryCode: field("factoryCode"),
      name: field("name"),
      category: field("category"),
      material: field("material"),
      priceBand: field("priceBand")
    };
  });
  writeState(next);
}

function persistSurveyDefinitionFields() {
  const moduleRows = [...document.querySelectorAll("[data-module-index]")];
  if (moduleRows.length) {
    applyResearchModules(moduleRows.map(readModuleRow));
  }

  document.querySelectorAll("[data-embedded-index]").forEach((row) => {
    const item = adminDraft.surveyDefinition.embeddedData[Number(row.dataset.embeddedIndex)];
    if (!item) return;
    item.key = row.querySelector("[data-embedded-field='key']").value.trim();
    item.value = row.querySelector("[data-embedded-field='value']").value.trim();
  });

  document.querySelectorAll("[data-quota-index]").forEach((row) => {
    const item = adminDraft.surveyDefinition.quotas[Number(row.dataset.quotaIndex)];
    if (!item) return;
    item.id = row.querySelector("[data-quota-field='id']").value.trim();
    item.segment = row.querySelector("[data-quota-field='segment']").value.trim();
    item.targetResponses = Number(row.querySelector("[data-quota-field='targetResponses']").value || 0);
  });

  const score = adminDraft.surveyDefinition.scoring;
  const scoreValue = (field) => document.querySelector(`[data-score-field="${field}"]`);
  if (scoreValue("pairwiseWeight")) {
    score.pairwiseWeight = Number(scoreValue("pairwiseWeight").value || 0);
    score.buyingIntentWeight = Number(scoreValue("buyingIntentWeight").value || 0);
    score.rankingWeight = Number(scoreValue("rankingWeight").value || 0);
    score.thresholds.buy = Number(scoreValue("buy").value || 0);
    score.thresholds.tweak = Number(scoreValue("tweak").value || 0);
  }

  const exportFields = document.querySelector("[data-export-fields]");
  if (exportFields) adminDraft.surveyDefinition.exportFields = splitList(exportFields.value.replaceAll("\n", ","));

  const ruleValue = (field) => document.querySelector(`[data-rule-field="${field}"]`);
  if (ruleValue("targetSegment")) {
    adminDraft.surveyDefinition.rules = {
      randomiseConcepts: ruleValue("randomiseConcepts").checked,
      balanceLeftRight: ruleValue("balanceLeftRight").checked,
      requireReasons: ruleValue("requireReasons").checked,
      targetSegment: ruleValue("targetSegment").value.trim(),
      maxConcepts: Number(ruleValue("maxConcepts").value || adminDraft.conceptIds.length),
      rewardTrigger: ruleValue("rewardTrigger").value
    };
  }
}

function readModuleRow(row) {
  const field = (name) => row.querySelector(`[data-module-field="${name}"]`);
  const type = field("type").value;
  const base = defaultModule(type, adminDraft);
  const scaleInput = field("scale");
  const optionsInput = field("options");
  const reasonsInput = field("reasons");
  const selectedConcepts = [...row.querySelectorAll("[data-module-concept]:checked")].map((input) => input.value);
  return {
    ...base,
    type,
    prompt: field("prompt").value.trim() || base.prompt,
    required: field("required")?.checked || false,
    collectReason: field("collectReason")?.checked || false,
    collectDrivers: field("collectDrivers")?.checked || false,
    scale: scaleInput ? splitList(scaleInput.value) : base.scale,
    options: optionsInput ? splitList(optionsInput.value) : base.options,
    reasons: reasonsInput ? splitList(reasonsInput.value) : base.reasons,
    conceptIds: selectedConcepts.length ? selectedConcepts : base.conceptIds
  };
}

function addResearchModule(type) {
  const modules = researchModules(adminDraft);
  modules.push(defaultModule(type, adminDraft));
  applyResearchModules(modules);
}

function applyPhysicalFocusGroupTemplate() {
  applyResearchModules([
    defaultModule("champion-battle", adminDraft),
    defaultModule("set-ranking", adminDraft),
    defaultModule("aspiration-pick", adminDraft),
    defaultModule("reason-diagnosis", adminDraft)
  ]);
  adminDraft.surveyDefinition.rules = {
    randomiseConcepts: true,
    balanceLeftRight: true,
    requireReasons: false,
    targetSegment: adminDraft.audience || "VIP customers in Singapore",
    maxConcepts: adminDraft.conceptIds.length,
    rewardTrigger: "completion"
  };
  adminDraft.surveyDefinition.scoring = {
    pairwiseWeight: 35,
    buyingIntentWeight: 0,
    rankingWeight: 35,
    thresholds: { buy: 65, tweak: 42 },
    aspirationWeight: 20,
    reasonWeight: 10
  };
}

function applyResearchModules(modules) {
  const intro = adminDraft.questions.find((question) => question.type === "intro") || {
    id: "intro",
    type: "intro",
    required: true,
    analyticsKey: "intro_viewed",
    eyebrow: "Private design council",
    title: "Help shape the next Sunday Staples launch",
    prompt: "Help shape the next Sunday Staples launch",
    body: "Review upcoming shoe concepts and tell us what deserves to be bought, tweaked, or rejected."
  };

  const questions = [intro, ...modules.map((module, index) => moduleToQuestion(module, index))];
  const blocks = [
    { id: "welcome-block", title: "Welcome", questionIds: ["intro"] },
    ...modules.map((module, index) => ({
      id: `module-${index + 1}-${module.type}`,
      title: module.label,
      questionIds: [moduleToQuestionId(module, index)],
      randomisation: {
        mode: adminDraft.surveyDefinition.rules?.randomiseConcepts ? "randomize_questions" : "none",
        balanceLeftRight: adminDraft.surveyDefinition.rules?.balanceLeftRight !== false
      }
    }))
  ];

  adminDraft.questions = questions;
  adminDraft.surveyDefinition.blocks = blocks;
  adminDraft.surveyDefinition.flow = blocks.map((block) => ({ type: "block", ref: block.id }));
  adminDraft.surveyDefinition.embeddedData = [
    { key: "brandId", value: adminDraft.brandId },
    { key: "campaignId", value: adminDraft.id },
    { key: "researchModules", value: modules.map((module) => module.type).join(",") },
    { key: "targetSegment", value: adminDraft.surveyDefinition.rules?.targetSegment || adminDraft.audience }
  ];
  adminDraft.surveyDefinition.exportFields = [
    "campaignId",
    "member.segment",
    "module.type",
    "answers",
    "decision.score",
    "submittedAt"
  ];
}

function moduleToQuestionId(module, index) {
  return `${module.type}-${index + 1}`;
}

function moduleToQuestion(module, index) {
  const id = moduleToQuestionId(module, index);
  const question = {
    id,
    type: module.questionType,
    required: module.required,
    analyticsKey: id,
    prompt: module.prompt,
    displayLogic: null,
    validation: module.validation || null,
    module: {
      type: module.type,
      label: module.label,
      prompt: module.prompt,
      collectReason: module.collectReason,
      collectDrivers: module.collectDrivers,
      conceptIds: module.conceptIds,
      scale: module.scale,
      options: module.options
    }
  };
  if (module.questionType === "pairwise") {
    question.pairs = pairConcepts(module.conceptIds || adminDraft.conceptIds);
    question.collectReason = module.collectReason;
    question.collectDrivers = module.collectDrivers;
  }
  if (module.questionType === "rating") question.scale = module.scale;
  if (module.questionType === "choice") question.options = module.options;
  if (module.questionType === "multi-select") question.maxSelections = module.maxSelections || 5;
  if (module.questionType === "reason-pool") question.reasons = module.reasons || defaultReasonPool();
  return question;
}

function pairConcepts(conceptIds) {
  const ids = [...conceptIds];
  const pairs = [];
  for (let index = 0; index < ids.length - 1; index += 2) {
    pairs.push([ids[index], ids[index + 1]]);
  }
  if (!pairs.length && ids.length >= 2) pairs.push([ids[0], ids[1]]);
  return pairs;
}

function splitList(value) {
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function importConceptFiles(files) {
  const mediaFiles = files.filter((file) => file.type.startsWith("image/") || file.type.startsWith("video/"));
  if (!mediaFiles.length) return;
  const next = readState();
  next.uploadedConcepts ||= [];
  const imported = await Promise.all(mediaFiles.map(fileToConcept));
  next.uploadedConcepts.push(...imported);
  const campaignIndex = next.campaigns.findIndex((campaign) => campaign.id === activeCampaignId);
  if (campaignIndex >= 0) {
    const campaign = next.campaigns[campaignIndex];
    campaign.conceptIds = [...new Set([...campaign.conceptIds, ...imported.map((concept) => concept.id)])];
  }
  writeState(next);
  adminDraft = null;
  render();
}

function fileToConcept(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const id = `upload-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const cleanName = file.name.replace(/\.[^.]+$/, "").replaceAll(/[-_]+/g, " ").trim();
      resolve({
        id,
        brandId: "sunday-staples",
        factoryCode: `UPLOAD-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}`,
        name: titleCase(cleanName || "Uploaded Concept"),
        category: "Uploaded Concept",
        targetSeason: "Unassigned",
        priceBand: "To be confirmed",
        material: "To be confirmed",
        colorway: "To be confirmed",
        media: [
          {
            type: file.type.startsWith("video/") ? "video" : "image",
            url: reader.result,
            alt: cleanName || file.name,
            fileName: file.name,
            mimeType: file.type,
            uploadedAt: new Date().toISOString()
          }
        ],
        notes: "Uploaded through the Inner Circle admin concept intake."
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function titleCase(value) {
  return value.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

function nextStep() {
  const questions = surveyQuestions(getCampaign());
  if (participant.step + 1 >= questions.length) {
    completeParticipant();
    return;
  }
  participant.step += 1;
  render();
}

function completeParticipant() {
  const next = readState();
  next.responses.push({
    id: crypto.randomUUID(),
    campaignId: getCampaign().id,
    member,
    answers: { ...participant.answers, ranking: participant.ranking },
    submittedAt: new Date().toISOString()
  });
  writeState(next);
  participant.completed = true;
  render();
}

function isLastQuestion() {
  const questions = surveyQuestions(getCampaign());
  return participant.step >= questions.length - 1;
}

function findConcept(id) {
  return state().concepts.find((concept) => concept.id === id);
}

function escapeAttr(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}

render();
