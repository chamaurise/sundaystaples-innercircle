const config = window.SUNDAY_CIRCLE_CONFIG || {};
const allDesigns = config.concepts || [];
const eligibleCustomers = config.eligibleCustomers || [];
const reviewSessions = config.reviewSessions || {};

const app = document.querySelector("#app");
const storageKey = "sunday-circle-responses";
const sessionKey = "sunday-circle-current";
const bracketKey = "sunday-circle-brackets";
const founderSessionKey = "sunday-circle-founder-session";
const imageSettingsKey = "sunday-circle-image-settings";
const comparisonModeKey = "sunday-circle-comparison-mode";
const groupRulesKey = "sunday-circle-group-rules";

const ageRanges = ["18-24", "25-34", "35-44", "45-54", "55+"];

let view = "review";
let customer = readSavedCustomer();
let review = freshReview();
let accessError = "";

function readSavedCustomer() {
  try {
    return JSON.parse(localStorage.getItem(sessionKey) || "null");
  } catch (error) {
    localStorage.removeItem(sessionKey);
    return null;
  }
}

function freshReview() {
  return {
    step: "access",
    battleIndex: 0,
    currentBattleId: "m1",
    battles: [],
    immediate: [],
    sessionId: currentSessionId(),
    ranking: activeDesigns().map((design) => design.id),
    noBudget: [],
    comments: "",
    usefulDetails: "",
    consent: true,
    completedAt: null
  };
}

function currentSessionId() {
  if (customer?.sessionId && reviewSessions[customer.sessionId]) return customer.sessionId;
  if (reviewSessions["pilot-5"]) return "pilot-5";
  return Object.keys(reviewSessions)[0] || "default";
}

function currentSession() {
  return reviewSessions[review.sessionId || currentSessionId()] || {
    name: "Default Review",
    designIds: allDesigns.map((design) => design.id),
    battleCount: Math.min(10, allDesigns.length)
  };
}

function activeDesigns() {
  const session = reviewSessions[currentSessionId()] || currentSession();
  const ids = session.designIds || allDesigns.map((design) => design.id);
  return ids.map((id) => findDesign(id)).filter(Boolean);
}

function activeBattlePairs() {
  const ids = activeDesigns().map((design) => design.id);
  const groupPairings = getGroupBracketForCustomer();
  if (groupPairings?.length) {
    return normaliseBattleItems(groupPairings, ids);
  }

  const custom = getCustomBrackets()[currentSessionId()];
  if (custom?.length) {
    return normaliseBattleItems(custom, ids);
  }

  const pairs = [];
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      pairs.push([ids[i], ids[j]]);
    }
  }
  const limit = currentSession().battleCount || pairs.length;
  return pairs.slice(0, Math.min(limit, pairs.length));
}

function normaliseBattleItems(items, ids) {
  return items
    .map((item, index) => {
      const pair = Array.isArray(item) ? item : item.pair;
      if (!pair || !ids.includes(pair[0]) || !ids.includes(pair[1]) || pair[0] === pair[1]) return null;
      return Array.isArray(item)
        ? pair
        : {
            id: item.id || `m${index + 1}`,
            pair,
            leftNext: item.leftNext || "next",
            rightNext: item.rightNext || "next"
          };
    })
    .filter(Boolean);
}

function activeBattleNodes() {
  return activeBattlePairs().map((item, index) => {
    if (Array.isArray(item)) {
      return {
        id: `m${index + 1}`,
        pair: item,
        leftNext: index + 1 < activeBattlePairs().length ? `m${index + 2}` : "end",
        rightNext: index + 1 < activeBattlePairs().length ? `m${index + 2}` : "end"
      };
    }
    return item;
  });
}

function currentBattleNode() {
  const nodes = activeBattleNodes();
  return nodes.find((node) => node.id === review.currentBattleId) || nodes[review.battleIndex] || nodes[0];
}

function getGroupRules() {
  try {
    return JSON.parse(localStorage.getItem(groupRulesKey) || "{}");
  } catch (error) {
    localStorage.removeItem(groupRulesKey);
    return {};
  }
}

function saveGroupRules(rules) {
  localStorage.setItem(groupRulesKey, JSON.stringify(rules));
}

function getGroupBracketForCustomer() {
  if (!customer?.ageRange) return null;
  const rule = getGroupRules()[currentSessionId()]?.[customer.ageRange];
  return rule?.length ? rule : null;
}

function getCustomBrackets() {
  try {
    return JSON.parse(localStorage.getItem(bracketKey) || "{}");
  } catch (error) {
    localStorage.removeItem(bracketKey);
    return {};
  }
}

function saveCustomBrackets(brackets) {
  localStorage.setItem(bracketKey, JSON.stringify(brackets));
}

function founderSessionId() {
  const saved = localStorage.getItem(founderSessionKey);
  if (saved && reviewSessions[saved]) return saved;
  if (reviewSessions["all-15"]) return "all-15";
  return Object.keys(reviewSessions)[0] || "default";
}

function sessionDesigns(sessionId) {
  const session = reviewSessions[sessionId] || currentSession();
  const ids = session.designIds || allDesigns.map((design) => design.id);
  return ids.map((id) => findDesign(id)).filter(Boolean);
}

function defaultBracketForSession(sessionId) {
  const ids = sessionDesigns(sessionId).map((design) => design.id);
  const pairs = [];
  for (let i = 0; i < Math.floor(ids.length / 2); i += 1) {
    pairs.push({
      id: `m${i + 1}`,
      pair: [ids[i], ids[ids.length - 1 - i]],
      leftNext: i + 1 < Math.floor(ids.length / 2) ? `m${i + 2}` : "end",
      rightNext: i + 1 < Math.floor(ids.length / 2) ? `m${i + 2}` : "end"
    });
  }
  return pairs;
}

function getResponses() {
  return JSON.parse(localStorage.getItem(storageKey) || "[]");
}

function saveResponses(responses) {
  localStorage.setItem(storageKey, JSON.stringify(responses));
}

function findDesign(id) {
  return allDesigns.find((design) => design.id === id);
}

function getImageSettings() {
  try {
    return JSON.parse(localStorage.getItem(imageSettingsKey) || "{}");
  } catch (error) {
    localStorage.removeItem(imageSettingsKey);
    return {};
  }
}

function saveImageSettings(settings) {
  localStorage.setItem(imageSettingsKey, JSON.stringify(settings));
}

function imageSetting(designId) {
  const saved = getImageSettings()[designId] || {};
  return {
    x: Number(saved.x ?? 50),
    y: Number(saved.y ?? 50),
    zoom: Number(saved.zoom ?? 100),
    snipX: Number(saved.snipX ?? 0),
    snipY: Number(saved.snipY ?? 0),
    aspect: String(saved.aspect || "1:1"),
    description: String(saved.description || ""),
    harmonise: Boolean(saved.harmonise)
  };
}

function imageStyle(design) {
  const setting = imageSetting(design.id);
  return `--c1:${design.c1};--c2:${design.c2};--image-x:${setting.x}%;--image-y:${setting.y}%;--image-zoom:${setting.zoom}%;--image-scale:${setting.zoom / 100};--snip-x:${setting.snipX}%;--snip-y:${setting.snipY}%;--crop-aspect:${aspectValue(setting.aspect)};`;
}

function aspectValue(aspect) {
  if (aspect === "4:6") return "4 / 6";
  if (aspect === "6:4") return "6 / 4";
  if (aspect === "4:5") return "4 / 5";
  return "1 / 1";
}

function displayDescription(design) {
  const description = imageSetting(design.id).description.trim();
  return description || design.note;
}

function comparisonModeEnabled() {
  return localStorage.getItem(comparisonModeKey) === "on";
}

function render() {
  app.innerHTML = `
    <div class="shell ${comparisonModeEnabled() ? "comparison-mode" : ""}">
      ${topbar()}
      <main class="main">
        ${view === "dashboard" ? dashboardScreen() : reviewScreen()}
      </main>
    </div>
  `;
  bindEvents();
}

function topbar() {
  return `
    <header class="topbar">
      <div class="brand">
        <div class="brand-mark">SS</div>
        <div>
          <div class="brand-name">Sunday Circle</div>
          <div class="brand-sub">Private Design Battle by Sunday Staples</div>
        </div>
      </div>
      <nav class="nav" aria-label="Main view">
        <button class="${view === "review" ? "active" : ""}" data-view="review">Member Review</button>
        <button class="${view === "dashboard" ? "active" : ""}" data-view="dashboard">Founder Dashboard</button>
      </nav>
    </header>
  `;
}

function reviewScreen() {
  if (!customer || review.step === "access") return accessScreen();
  if (review.step === "battle" && !currentBattleNode()) review.step = "immediate";
  if (review.step === "battle") return battleScreen();
  if (review.step === "immediate") return immediateScreen();
  if (review.step === "ranking") return rankingScreen();
  if (review.step === "nobudget") return noBudgetScreen();
  if (review.step === "final") return finalFeedbackScreen();
  return completeScreen();
}

function accessScreen() {
  return `
    <section class="hero screen">
      <div>
        <div class="eyebrow">Invite-only preview</div>
        <h1>Sunday Circle</h1>
        <p class="lede">A private design council for friends and top-tier Sunday Staples customers. Preview upcoming shoe concepts, vote in design battles, and earn Sunday Points for thoughtful feedback.</p>
        <div class="prestige-note">Invitation only - comfort-led design - private customer influence</div>
        <div class="member-strip">
          <div class="stat"><strong>15</strong><span>shoe concepts ready</span></div>
          <div class="stat"><strong>Custom</strong><span>views by customer</span></div>
          <div class="stat"><strong>150</strong><span>possible points</span></div>
          <div class="stat"><strong>5 min</strong><span>target time</span></div>
        </div>
      </div>
      <form class="access-panel form-grid" data-action="access">
        <div>
          <div class="eyebrow">Private access</div>
          <h2>Enter with your Sunday Staples email</h2>
          <p class="hint">For this local pilot, try maurice@sundaystaples.com, vip@sundaystaples.com, or friend@sundaystaples.com.</p>
        </div>
        <div class="field">
          <label for="email">Sunday Staples customer email</label>
          <input id="email" name="email" type="email" placeholder="you@example.com" required />
        </div>
        <div class="field">
          <label for="ageRange">Age range</label>
          <select id="ageRange" name="ageRange" required>
            <option value="">Select age range</option>
            ${ageRanges.map((range) => `<option value="${range}">${range}</option>`).join("")}
          </select>
        </div>
        <button class="primary-button" type="submit">Start Design Battle</button>
        ${accessError ? `<p class="error">${accessError}</p>` : ""}
        <p class="hint">Your votes stay anonymous in the review experience. Your email is used only to confirm access and prepare Sunday Points rewards.</p>
        <div class="hero-gallery">
          ${allDesigns.slice(0, 4).map((design) => `<img style="${imageStyle(design)}" src="${design.image}" alt="${design.name}" />`).join("")}
        </div>
      </form>
    </section>
  `;
}

function battleScreen() {
  const battleNodes = activeBattleNodes();
  const node = currentBattleNode();
  const pair = node.pair;
  const left = findDesign(pair[0]);
  const right = findDesign(pair[1]);
  const progress = Math.round((review.battles.length / battleNodes.length) * 100);
  return `
    <section class="screen">
      ${memberSummary()}
      <div class="eyebrow">Battle ${review.battles.length + 1} of ${battleNodes.length}</div>
      <h2>Which design do you prefer?</h2>
      <p class="lede">Choose with your instinct first. The goal is to capture real taste, not overthink the answer.</p>
      <div class="progress" style="--progress:${progress}%"><span></span></div>
      <div class="battle-grid">
        ${designCard(left, "Choose this design", "battle-choice")}
        ${designCard(right, "Choose this design", "battle-choice")}
      </div>
      <div class="field">
        <label for="battleWhy">Why did that design win for you?</label>
        <textarea id="battleWhy" placeholder="Shape, color, comfort, outfit potential, uniqueness..."></textarea>
      </div>
    </section>
  `;
}

function immediateScreen() {
  return multiSelectScreen({
    stepName: "Purchase Intent",
    title: "Which designs would make you want to purchase immediately?",
    body: "This separates general liking from actual buying desire.",
    selected: review.immediate,
    action: "toggle-immediate",
    next: "ranking",
    nextLabel: "Rank all designs"
  });
}

function rankingScreen() {
  return `
    <section class="screen">
      ${memberSummary()}
      <div class="eyebrow">Full ranking</div>
      <h2>Rank these designs from most favourite to least favourite</h2>
      <p class="lede">Use the arrows to put your strongest favourite at the top.</p>
      <div class="rank-list">
        ${review.ranking.map((id, index) => rankItem(findDesign(id), index)).join("")}
      </div>
      <div class="button-row" style="margin-top:18px">
        <button class="ghost-button" data-step="immediate">Back</button>
        <button class="primary-button" data-step="nobudget">Continue</button>
      </div>
    </section>
  `;
}

function noBudgetScreen() {
  return multiSelectScreen({
    stepName: "No-budget desire",
    title: "If money was not an issue, which designs would you certainly purchase?",
    body: "This shows pure desire without price sensitivity getting in the way.",
    selected: review.noBudget,
    action: "toggle-nobudget",
    next: "final",
    nextLabel: "Final feedback"
  });
}

function finalFeedbackScreen() {
  return `
    <section class="screen">
      ${memberSummary()}
      <div class="eyebrow">Final thoughts</div>
      <h2>Help us make the winning design better</h2>
      <div class="question-block">
        <div class="field">
          <label for="comments">What should Sunday Staples make first, and why?</label>
          <textarea id="comments" placeholder="Tell us what you would genuinely want to see launched.">${review.comments}</textarea>
        </div>
        <div class="field">
          <label for="usefulDetails">Any changes to color, heel height, material, comfort, shape, or styling?</label>
          <textarea id="usefulDetails" placeholder="Small design details are especially useful.">${review.usefulDetails}</textarea>
        </div>
        <label class="hint">
          <input type="checkbox" data-action="consent" ${review.consent ? "checked" : ""} />
          Sunday Staples may use my feedback anonymously for product decisions and internal reports.
        </label>
        <div class="button-row">
          <button class="ghost-button" data-step="nobudget">Back</button>
          <button class="primary-button" data-action="complete">Complete Review</button>
        </div>
      </div>
    </section>
  `;
}

function completeScreen() {
  const points = calculatePoints(review);
  return `
    <section class="screen">
      ${memberSummary()}
      <div class="panel">
        <div class="eyebrow">Review complete</div>
        <h2>Thank you for shaping the next Sunday Staples design.</h2>
        <p class="lede">Your influence has been recorded anonymously. Your Sunday Points reward is ready for founder approval in this pilot version.</p>
        <div class="member-strip">
          <div class="stat"><strong>${points}</strong><span>pending Sunday Points</span></div>
          <div class="stat"><strong>${review.immediate.length}</strong><span>buy-now picks</span></div>
          <div class="stat"><strong>${review.noBudget.length}</strong><span>no-budget picks</span></div>
          <div class="stat"><strong>${review.ranking[0] ? findDesign(review.ranking[0]).name : "-"}</strong><span>top-ranked design</span></div>
        </div>
        <div class="button-row">
          <button class="primary-button" data-view="dashboard">View Founder Dashboard</button>
          <button class="ghost-button" data-action="new-review">Start another test review</button>
        </div>
      </div>
    </section>
  `;
}

function multiSelectScreen(config) {
  return `
    <section class="screen">
      ${memberSummary()}
      <div class="eyebrow">${config.stepName}</div>
      <h2>${config.title}</h2>
      <p class="lede">${config.body}</p>
      <div class="option-grid">
        ${activeDesigns().map((design) => miniDesign(design, config.selected.includes(design.id), config.action)).join("")}
      </div>
      <div class="button-row" style="margin-top:18px">
        <button class="ghost-button" data-step="${config.stepName === "Purchase Intent" ? "battle" : "ranking"}">Back</button>
        <button class="primary-button" data-step="${config.next}">${config.nextLabel}</button>
      </div>
    </section>
  `;
}

function memberSummary() {
  return `
    <div class="member-strip">
      <div class="stat"><strong>${customer.name}</strong><span>${customer.tier}</span></div>
      <div class="stat"><strong>${customer.currentPoints.toLocaleString()}</strong><span>current Sunday Points</span></div>
      <div class="stat"><strong>${customer.smileId}</strong><span>linked Smile.io account</span></div>
      <div class="stat"><strong>${calculatePoints(review)}</strong><span>pending points</span></div>
    </div>
  `;
}

function designCard(design, buttonLabel, action) {
  return `
    <article class="design-card">
      ${design.image ? `<img class="shoe-image" style="${imageStyle(design)}" src="${design.image}" alt="${design.name}" onerror="this.replaceWith(this.nextElementSibling)" />` : ""}
      <div class="shoe-art" style="${imageStyle(design)}">${shoeSvg(design)}</div>
      <div class="design-body">
        <h3>${design.name}</h3>
        <p class="hint">${displayDescription(design)}</p>
        <div class="design-meta">
          <span class="pill">${design.style}</span>
          <span class="pill">${design.material}</span>
          <span class="pill">${design.price}</span>
        </div>
        <button class="choice-button" data-action="${action}" data-id="${design.id}">${buttonLabel}</button>
      </div>
    </article>
  `;
}

function miniDesign(design, selected, action) {
  const background = design.image ? `background-image: url('${design.image}')` : "";
  const placeholder = design.image ? "" : "placeholder";
  return `
    <button class="mini-design ${selected ? "selected" : ""}" data-action="${action}" data-id="${design.id}">
      <span class="mini-swatch ${placeholder}" style="${imageStyle(design)}${background}"></span>
      <strong>${design.name}</strong>
      <span class="hint">${selected ? "Selected" : displayDescription(design)}</span>
    </button>
  `;
}

function rankItem(design, index) {
  return `
    <div class="rank-item">
      <div class="rank-number">${index + 1}</div>
      <div>
        <strong>${design.name}</strong>
        <div class="hint">${design.style} - ${design.price}</div>
      </div>
      <div class="rank-controls">
        <button class="small-button" data-action="rank-up" data-index="${index}" aria-label="Move ${design.name} up">Up</button>
        <button class="small-button" data-action="rank-down" data-index="${index}" aria-label="Move ${design.name} down">Down</button>
      </div>
    </div>
  `;
}

function shoeSvg(design) {
  return `
    <svg class="shoe-svg" viewBox="0 0 520 260" role="img" aria-label="${design.name} concept art">
      <path d="M58 160 C120 112 195 94 298 112 C353 121 398 133 471 153 C485 157 492 172 484 186 C473 205 438 215 373 212 L101 200 C62 198 40 184 58 160 Z" fill="#fff8ef"/>
      <path d="M95 172 C170 142 275 142 392 168" fill="none" stroke="#202020" stroke-width="10" stroke-linecap="round"/>
      <path d="M298 112 C309 83 339 66 379 62 C388 61 394 69 389 77 C374 101 367 124 377 146" fill="none" stroke="#202020" stroke-width="14" stroke-linecap="round"/>
      <path d="M388 170 L425 215" stroke="#202020" stroke-width="12" stroke-linecap="round"/>
      <path d="M128 196 C214 212 326 216 438 204" fill="none" stroke="#202020" stroke-width="13" stroke-linecap="round"/>
      <circle cx="196" cy="149" r="10" fill="${design.c2}"/>
      <circle cx="240" cy="143" r="10" fill="${design.c2}"/>
    </svg>
  `;
}

function dashboardScreen() {
  const responses = getResponses();
  const metrics = buildMetrics(responses);
  return `
    <section class="screen">
      <div class="eyebrow">Founder view</div>
      <h2>Design Battle Results</h2>
      <p class="lede">This dashboard shows the first closed-loop signals: preference, buy-now intent, pure desire, ranking, and pending Sunday Points rewards.</p>
      ${responses.length ? dashboardContent(responses, metrics) : emptyDashboard()}
      ${founderControls()}
    </section>
  `;
}

function emptyDashboard() {
  return `
    <div class="empty">
      No completed reviews yet. Start with the Member Review tab, use one of the pilot emails, and complete the design battle.
    </div>
    ${conceptLibrary(allDesigns)}
  `;
}

function dashboardContent(responses, metrics) {
  const top = metrics[0];
  return `
    <div class="member-strip">
      <div class="stat"><strong>${responses.length}</strong><span>completed reviews</span></div>
      <div class="stat"><strong>${top ? top.name : "-"}</strong><span>current winner</span></div>
      <div class="stat"><strong>${responses.reduce((sum, item) => sum + item.points, 0)}</strong><span>pending points</span></div>
      <div class="stat"><strong>${responses.filter((item) => item.consent).length}</strong><span>anonymous feedback consents</span></div>
    </div>
    <div class="dashboard-grid">
      <div class="panel">
        <h3>Product Signals</h3>
        <div class="results-list">
          ${metrics.map((item) => resultRow(item)).join("")}
        </div>
      </div>
      <div class="panel">
        <h3>AI-style Summary</h3>
        ${summary(metrics, responses)}
        <div class="button-row" style="margin-top:18px">
          <button class="primary-button" data-action="export">Export feedback JSON</button>
          <button class="ghost-button" data-action="reset-data">Clear pilot data</button>
        </div>
      </div>
    </div>
    ${conceptLibrary(metrics.map((item) => findDesign(item.id)).filter(Boolean))}
  `;
}

function resultRow(item) {
  const design = findDesign(item.id);
  return `
    <div class="result-row">
      <div class="result-head">
        <img style="${imageStyle(design)}" src="${design.image}" alt="${item.name}" />
        <div>
          <strong>${item.name}</strong>
          <span class="hint">Battle wins ${item.wins}, buy-now ${item.immediate}, no-budget ${item.noBudget}, rank score ${item.rankScore}</span>
        </div>
      </div>
      <div class="result-line" style="--w:${Math.min(100, item.score)}%"><span></span></div>
    </div>
  `;
}

function conceptLibrary(designs) {
  return `
    <div class="panel concept-library">
      <div class="panel-title">
        <div>
          <h3>Founder Visual Library</h3>
          <p class="hint">Use this image grid to identify SKUs quickly as the review pool grows.</p>
        </div>
      </div>
      <div class="concept-grid">
        ${designs.map((design) => `
          <article class="concept-tile">
            <img style="${imageStyle(design)}" src="${design.image}" alt="${design.name}" />
            <div>
              <strong>${design.name}</strong>
              <span>${displayDescription(design)}</span>
            </div>
          </article>
        `).join("")}
      </div>
    </div>
  `;
}

function founderControls() {
  const selectedSession = founderSessionId();
  const brackets = getCustomBrackets();
  const pairs = brackets[selectedSession]?.length ? brackets[selectedSession] : defaultBracketForSession(selectedSession);
  return `
    ${imagePrepControls()}
    <div class="panel founder-controls">
      <div class="panel-title">
        <div>
          <div class="eyebrow">Backend controls</div>
          <h3>Bracket Customisation</h3>
          <p class="hint">Choose exactly which shoes face each other. Saved brackets apply immediately to customers assigned to that session.</p>
        </div>
        <select class="session-select" data-action="select-founder-session">
          ${Object.entries(reviewSessions).map(([id, session]) => `<option value="${id}" ${id === selectedSession ? "selected" : ""}>${session.name}</option>`).join("")}
        </select>
      </div>
      <div class="bracket-list">
        ${pairs.map((pair, index) => bracketRow(pair, index, selectedSession)).join("")}
      </div>
      <div class="button-row">
        <button class="primary-button" data-action="save-bracket">Save logic tree</button>
        <button class="ghost-button" data-action="add-match">Add match</button>
        <button class="ghost-button" data-action="round-16">Use Round of 16 style</button>
        <button class="ghost-button" data-action="clear-bracket">Reset to automatic</button>
      </div>
      <p class="hint">Set each matchup, then choose where the customer goes if the left or right shoe wins. Use "End review" when a branch should finish early.</p>
    </div>
    ${logicTreeReview(selectedSession, pairs)}
    ${groupRuleControls(selectedSession, pairs)}
  `;
}

function logicTreeReview(sessionId, pairs) {
  const nodes = pairs.map((item, index) => Array.isArray(item)
    ? {
        id: `m${index + 1}`,
        pair: item,
        leftNext: index + 1 < pairs.length ? `m${index + 2}` : "end",
        rightNext: index + 1 < pairs.length ? `m${index + 2}` : "end"
      }
    : item);
  const insights = analyseLogicTree(nodes);
  return `
    <div class="panel logic-review">
      <div class="panel-title">
        <div>
          <div class="eyebrow">Founder readout</div>
          <h3>Logic Tree Review</h3>
          <p class="hint">This translates your saved match routes into plain English so you can see what customer journey you are creating.</p>
        </div>
      </div>
      <div class="logic-summary-grid">
        <div class="stat"><strong>${nodes.length}</strong><span>possible battles</span></div>
        <div class="stat"><strong>${insights.branchCount}</strong><span>true branches</span></div>
        <div class="stat"><strong>${insights.endCount}</strong><span>early endings</span></div>
        <div class="stat"><strong>${insights.unreachable.length}</strong><span>unreachable matches</span></div>
      </div>
      <div class="logic-readout">
        ${insights.commentary.map((line) => `<p>${line}</p>`).join("")}
        ${insights.warnings.length ? `<div class="warning-list">${insights.warnings.map((line) => `<p>${line}</p>`).join("")}</div>` : ""}
      </div>
    </div>
  `;
}

function analyseLogicTree(nodes) {
  const ids = nodes.map((node) => node.id);
  const byId = Object.fromEntries(nodes.map((node) => [node.id, node]));
  const branchCount = nodes.filter((node) => node.leftNext !== node.rightNext).length;
  const endCount = nodes.filter((node) => node.leftNext === "end" || node.rightNext === "end").length;
  const reachable = new Set();
  const warnings = [];

  function walk(id, path = []) {
    if (!id || id === "end") return;
    if (!byId[id]) {
      warnings.push(`A route points to ${id}, but that match does not exist.`);
      return;
    }
    if (path.includes(id)) {
      warnings.push(`There is a loop around ${id}. A customer may get stuck repeating battles.`);
      return;
    }
    reachable.add(id);
    walk(byId[id].leftNext, [...path, id]);
    walk(byId[id].rightNext, [...path, id]);
  }

  walk(ids[0]);
  const unreachable = ids.filter((id) => !reachable.has(id));
  if (unreachable.length) warnings.push(`${unreachable.join(", ")} cannot be reached from Match 1.`);

  const commentary = nodes.slice(0, 6).map((node, index) => {
    const left = findDesign(node.pair[0])?.name || node.pair[0];
    const right = findDesign(node.pair[1])?.name || node.pair[1];
    if (node.leftNext === node.rightNext) {
      return `Match ${index + 1} is a calibration battle: whether ${left} or ${right} wins, the customer goes to ${routeLabel(node.leftNext)}.`;
    }
    return `Match ${index + 1} is a preference splitter: choosing ${left} sends the customer to ${routeLabel(node.leftNext)}, while choosing ${right} sends them to ${routeLabel(node.rightNext)}.`;
  });

  if (nodes.length > 6) commentary.push(`There are ${nodes.length - 6} more matches after this, so the tree is becoming a more advanced segmentation flow.`);
  if (!branchCount) commentary.unshift("At the moment, this behaves like a fixed bracket rather than a branching logic tree, because every outcome follows the same next step.");
  else commentary.unshift("You appear to be using early battles to classify taste, then sending customers into different follow-up comparisons based on what they choose.");

  return { branchCount, endCount, unreachable, warnings, commentary };
}

function routeLabel(route) {
  if (!route || route === "end") return "the end of the review";
  return route.replace("m", "Match ");
}

function groupRuleControls(sessionId, fallbackPairs) {
  const rules = getGroupRules()[sessionId] || {};
  return `
    <div class="panel founder-controls">
      <div class="panel-title">
        <div>
          <div class="eyebrow">Backend controls</div>
          <h3>Customer Group Assignment</h3>
          <p class="hint">Assign a saved match order to customers based on the age range they select before entering.</p>
        </div>
      </div>
      <div class="group-rule-grid">
        ${ageRanges.map((range) => groupRuleCard(range, rules[range] || [], fallbackPairs)).join("")}
      </div>
      <div class="button-row" style="margin-top:16px">
        <button class="primary-button" data-action="save-group-rules">Save group rules</button>
        <button class="ghost-button" data-action="copy-bracket-to-groups">Copy current bracket to all age ranges</button>
        <button class="ghost-button" data-action="clear-group-rules">Clear group rules</button>
      </div>
      <p class="hint">If an age range has no assigned order, that customer receives the main session bracket.</p>
    </div>
  `;
}

function groupRuleCard(range, pairs, fallbackPairs) {
  const previewPairs = pairs.length ? pairs : fallbackPairs;
  return `
    <article class="group-rule-card" data-group-rule="${range}">
      <div>
        <strong>${range}</strong>
        <span class="hint">${pairs.length ? `${pairs.length} custom matches` : "Uses main bracket"}</span>
      </div>
      <div class="group-preview">
        ${previewPairs.slice(0, 3).map((item) => matchupPreview(Array.isArray(item) ? item : item.pair)).join("")}
      </div>
      <div class="button-row">
        <button class="small-button" data-action="assign-current-bracket" data-age="${range}">Assign current</button>
        <button class="small-button" data-action="clear-age-rule" data-age="${range}">Clear</button>
      </div>
    </article>
  `;
}

function matchupPreview(pair) {
  const left = findDesign(pair[0]);
  const right = findDesign(pair[1]);
  if (!left || !right) return "";
  return `
    <div class="matchup-preview">
      <img style="${imageStyle(left)}" src="${left.image}" alt="${left.name}" />
      <span>vs</span>
      <img style="${imageStyle(right)}" src="${right.image}" alt="${right.name}" />
    </div>
  `;
}

function imagePrepControls() {
  return `
    <div class="panel image-controls">
      <div class="panel-title">
        <div>
          <div class="eyebrow">Backend controls</div>
          <h3>Image Prep Studio</h3>
          <p class="hint">Crop, position, label, and mark images for AI harmonisation before customers review them.</p>
        </div>
        <label class="switch-row">
          <input type="checkbox" data-action="comparison-mode" ${comparisonModeEnabled() ? "checked" : ""} />
          Uniform preview
        </label>
      </div>
      <div class="image-control-grid">
        ${allDesigns.map((design) => imageControlCard(design)).join("")}
      </div>
      <div class="button-row" style="margin-top:16px">
        <button class="primary-button" data-action="save-image-settings">Save image settings</button>
        <button class="ghost-button" data-action="reset-image-settings">Reset image settings</button>
      </div>
      <p class="hint">AI harmonisation is captured as a production flag for now. The current local preview uses a uniform comparison treatment; later this can trigger a real AI image-processing queue.</p>
    </div>
  `;
}

function imageControlCard(design) {
  const setting = imageSetting(design.id);
  return `
    <article class="image-control-card" data-image-control="${design.id}">
      <div class="crop-stage" data-crop-stage style="${imageStyle(design)}">
        <img class="control-preview" draggable="false" style="${imageStyle(design)}" src="${design.image}" alt="${design.name}" />
        <div class="crop-frame"></div>
        <div class="crop-instruction">Drag image to crop</div>
      </div>
      <div class="control-body">
        <strong>${design.name}</strong>
        <div class="crop-presets" data-image-field="aspect">
          ${["1:1", "4:6", "6:4", "4:5"].map((aspect) => `<button type="button" class="${setting.aspect === aspect ? "active" : ""}" data-aspect="${aspect}">${aspect}</button>`).join("")}
        </div>
        <label>
          30 character description
          <input data-image-field="description" maxlength="30" value="${escapeAttribute(setting.description)}" placeholder="e.g. Soft mesh floral flat" />
        </label>
        <input data-image-field="x" type="hidden" value="${setting.x}" />
        <input data-image-field="y" type="hidden" value="${setting.y}" />
        <label>
          Horizontal snip
          <input data-image-field="snipX" type="range" min="0" max="40" value="${setting.snipX}" />
        </label>
        <label>
          Vertical snip
          <input data-image-field="snipY" type="range" min="0" max="40" value="${setting.snipY}" />
        </label>
        <label>
          Zoom
          <input data-image-field="zoom" type="range" min="70" max="180" value="${setting.zoom}" />
        </label>
        <label class="switch-row small-switch">
          <input data-image-field="harmonise" type="checkbox" ${setting.harmonise ? "checked" : ""} />
          AI harmonise
        </label>
      </div>
    </article>
  `;
}

function escapeAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function bracketRow(pair, index, sessionId) {
  const designs = sessionDesigns(sessionId);
  const item = Array.isArray(pair) ? { id: `m${index + 1}`, pair, leftNext: "next", rightNext: "next" } : pair;
  const left = findDesign(item.pair[0]) || designs[0];
  const right = findDesign(item.pair[1]) || designs[1] || designs[0];
  const allItems = getDisplayBracketItems(sessionId);
  return `
    <div class="bracket-row" data-bracket-row data-index="${index}" draggable="true">
      <div class="drag-handle" title="Drag to reorder">Drag</div>
      <div class="rank-number">${index + 1}</div>
      <img class="bracket-thumb" data-thumb-side="left" style="${imageStyle(left)}" src="${left.image}" alt="${left.name}" />
      ${bracketSelect(item.pair[0], designs, "left")}
      <span class="versus">vs</span>
      <img class="bracket-thumb" data-thumb-side="right" style="${imageStyle(right)}" src="${right.image}" alt="${right.name}" />
      ${bracketSelect(item.pair[1], designs, "right")}
      <button class="small-button" data-action="remove-match" data-index="${index}">Remove</button>
      <div class="logic-routes">
        <input type="hidden" data-route-field="id" value="${item.id || `m${index + 1}`}" />
        <label>If left wins ${routeSelect(item.leftNext, allItems, index, "leftNext")}</label>
        <label>If right wins ${routeSelect(item.rightNext, allItems, index, "rightNext")}</label>
      </div>
    </div>
  `;
}

function getDisplayBracketItems(sessionId) {
  const brackets = getCustomBrackets();
  const items = brackets[sessionId]?.length ? brackets[sessionId] : defaultBracketForSession(sessionId);
  return items.map((item, index) => Array.isArray(item) ? { id: `m${index + 1}`, pair: item } : item);
}

function bracketSelect(value, designs, side) {
  return `
    <select data-bracket-side="${side}">
      ${designs.map((design) => `<option value="${design.id}" ${design.id === value ? "selected" : ""}>${design.name}</option>`).join("")}
    </select>
  `;
}

function routeSelect(value, items, currentIndex, field) {
  const options = items
    .map((item, index) => `<option value="${item.id || `m${index + 1}`}" ${value === (item.id || `m${index + 1}`) ? "selected" : ""}>Match ${index + 1}</option>`)
    .join("");
  const nextId = items[currentIndex + 1]?.id || `m${currentIndex + 2}`;
  const selected = value || nextId || "end";
  return `
    <select data-route-field="${field}">
      <option value="next" ${selected === "next" ? "selected" : ""}>Next match</option>
      ${options}
      <option value="end" ${selected === "end" ? "selected" : ""}>End review</option>
    </select>
  `;
}

function summary(metrics, responses) {
  const winner = metrics[0];
  const buyNow = [...metrics].sort((a, b) => b.immediate - a.immediate)[0];
  const desire = [...metrics].sort((a, b) => b.noBudget - a.noBudget)[0];
  const quotes = responses.flatMap((item) => [item.comments, item.usefulDetails]).filter(Boolean);
  const quote = quotes[quotes.length - 1] || "Complete more reviews to reveal richer customer language.";
  return `
    <p class="hint">Recommended first read:</p>
    <p><strong>${winner.name}</strong> is leading overall based on battle wins, ranking strength, and purchase signals.</p>
    <p><strong>${buyNow.name}</strong> has the strongest immediate-purchase signal. <strong>${desire.name}</strong> is strongest when price is removed.</p>
    <p class="quote">"${quote}"</p>
    <p class="hint">Reward status: ${responses.length} customer review${responses.length === 1 ? "" : "s"} awaiting Sunday Points approval through Smile.io.</p>
  `;
}

function buildMetrics(responses) {
  const usedIds = [...new Set(responses.flatMap((response) => response.ranking || []))];
  const sourceDesigns = usedIds.length ? usedIds.map((id) => findDesign(id)).filter(Boolean) : allDesigns;
  const rows = sourceDesigns.map((design) => ({
    id: design.id,
    name: design.name,
    wins: 0,
    immediate: 0,
    noBudget: 0,
    rankScore: 0,
    score: 0
  }));
  const byId = Object.fromEntries(rows.map((row) => [row.id, row]));

  responses.forEach((response) => {
    response.battles.forEach((battle) => {
      if (byId[battle.winner]) byId[battle.winner].wins += 1;
    });
    response.immediate.forEach((id) => {
      if (byId[id]) byId[id].immediate += 1;
    });
    response.noBudget.forEach((id) => {
      if (byId[id]) byId[id].noBudget += 1;
    });
    response.ranking.forEach((id, index) => {
      if (byId[id]) byId[id].rankScore += response.ranking.length - index;
    });
  });

  rows.forEach((row) => {
    row.score = row.wins * 7 + row.immediate * 12 + row.noBudget * 9 + row.rankScore * 3;
  });

  return rows.sort((a, b) => b.score - a.score);
}

function calculatePoints(currentReview) {
  let points = 0;
  points += currentReview.battles.length === activeBattlePairs().length ? 100 : currentReview.battles.length * 5;
  if (currentReview.comments.trim().length > 30) points += 25;
  if (currentReview.usefulDetails.trim().length > 30) points += 25;
  return points;
}

function bindEvents() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      view = button.dataset.view;
      render();
    });
  });

  const accessForm = document.querySelector("[data-action='access']");
  if (accessForm) {
    accessForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const email = new FormData(accessForm).get("email").toLowerCase().trim();
      const match = eligibleCustomers.find((item) => item.email === email);
      if (!match) {
        accessError = "This email is not on the private pilot list yet.";
        render();
        return;
      }
      customer = {
        ...match,
        ageRange: new FormData(accessForm).get("ageRange")
      };
      localStorage.setItem(sessionKey, JSON.stringify(customer));
      accessError = "";
      review = freshReview();
      review.step = "battle";
      render();
    });
  }

  document.querySelectorAll("[data-action='battle-choice']").forEach((button) => {
    button.addEventListener("click", () => {
      const node = currentBattleNode();
      const pair = node.pair;
      const why = document.querySelector("#battleWhy")?.value || "";
      const winnerSide = button.dataset.id === pair[0] ? "left" : "right";
      const next = winnerSide === "left" ? node.leftNext : node.rightNext;
      review.battles.push({
        nodeId: node.id,
        pair,
        winner: button.dataset.id,
        winnerSide,
        next,
        reason: why.trim()
      });
      review.battleIndex += 1;
      if (next && next !== "end" && activeBattleNodes().some((item) => item.id === next)) {
        review.currentBattleId = next;
      } else if (next === "next") {
        review.currentBattleId = `m${review.battleIndex + 1}`;
      } else {
        review.step = "immediate";
      }
      render();
    });
  });

  document.querySelectorAll("[data-step]").forEach((button) => {
    button.addEventListener("click", () => {
      review.step = button.dataset.step;
      render();
    });
  });

  document.querySelectorAll("[data-action='toggle-immediate']").forEach((button) => {
    button.addEventListener("click", () => {
      toggle(review.immediate, button.dataset.id);
      render();
    });
  });

  document.querySelectorAll("[data-action='toggle-nobudget']").forEach((button) => {
    button.addEventListener("click", () => {
      toggle(review.noBudget, button.dataset.id);
      render();
    });
  });

  document.querySelectorAll("[data-action='rank-up'], [data-action='rank-down']").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.index);
      const direction = button.dataset.action === "rank-up" ? -1 : 1;
      moveRank(index, direction);
      render();
    });
  });

  document.querySelector("[data-action='consent']")?.addEventListener("change", (event) => {
    review.consent = event.target.checked;
  });

  document.querySelector("[data-action='complete']")?.addEventListener("click", () => {
    review.comments = document.querySelector("#comments")?.value.trim() || "";
    review.usefulDetails = document.querySelector("#usefulDetails")?.value.trim() || "";
    review.completedAt = new Date().toISOString();
    const responses = getResponses();
    responses.push({
      sessionId: review.sessionId,
      sessionName: currentSession().name,
      customerEmail: customer.email,
      ageRange: customer.ageRange,
      shopifyId: customer.shopifyId,
      smileId: customer.smileId,
      tier: customer.tier,
      battles: review.battles,
      immediate: review.immediate,
      ranking: review.ranking,
      noBudget: review.noBudget,
      comments: review.comments,
      usefulDetails: review.usefulDetails,
      consent: review.consent,
      points: calculatePoints(review),
      rewardStatus: "Pending founder approval",
      completedAt: review.completedAt
    });
    saveResponses(responses);
    review.step = "complete";
    render();
  });

  document.querySelector("[data-action='new-review']")?.addEventListener("click", () => {
    review = freshReview();
    review.step = "access";
    customer = null;
    localStorage.removeItem(sessionKey);
    render();
  });

  document.querySelector("[data-action='reset-data']")?.addEventListener("click", () => {
    if (confirm("Clear all local pilot responses?")) {
      saveResponses([]);
      render();
    }
  });

  document.querySelector("[data-action='export']")?.addEventListener("click", () => {
    const payload = JSON.stringify(getResponses(), null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "sunday-circle-feedback.json";
    link.click();
    URL.revokeObjectURL(url);
  });

  document.querySelector("[data-action='select-founder-session']")?.addEventListener("change", (event) => {
    localStorage.setItem(founderSessionKey, event.target.value);
    render();
  });

  document.querySelector("[data-action='save-bracket']")?.addEventListener("click", () => {
    const sessionId = founderSessionId();
    const brackets = getCustomBrackets();
    brackets[sessionId] = readBracketRows();
    saveCustomBrackets(brackets);
    render();
  });

  document.querySelector("[data-action='add-match']")?.addEventListener("click", () => {
    const sessionId = founderSessionId();
    const designs = sessionDesigns(sessionId);
    if (designs.length < 2) return;
    const brackets = getCustomBrackets();
    brackets[sessionId] = readBracketRows();
    const nextIndex = brackets[sessionId].length + 1;
    brackets[sessionId].push({
      id: `m${nextIndex}`,
      pair: [designs[0].id, designs[1].id],
      leftNext: "end",
      rightNext: "end"
    });
    saveCustomBrackets(brackets);
    render();
  });

  document.querySelector("[data-action='round-16']")?.addEventListener("click", () => {
    const sessionId = founderSessionId();
    const brackets = getCustomBrackets();
    brackets[sessionId] = defaultBracketForSession(sessionId);
    saveCustomBrackets(brackets);
    render();
  });

  document.querySelector("[data-action='clear-bracket']")?.addEventListener("click", () => {
    const sessionId = founderSessionId();
    const brackets = getCustomBrackets();
    delete brackets[sessionId];
    saveCustomBrackets(brackets);
    render();
  });

  document.querySelectorAll("[data-action='remove-match']").forEach((button) => {
    button.addEventListener("click", () => {
      const sessionId = founderSessionId();
      const brackets = getCustomBrackets();
      const rows = readBracketRows();
      rows.splice(Number(button.dataset.index), 1);
      brackets[sessionId] = rows;
      saveCustomBrackets(brackets);
      render();
    });
  });

  document.querySelectorAll("[data-bracket-side]").forEach((select) => {
    select.addEventListener("change", () => updateBracketThumb(select.closest("[data-bracket-row]"), select.dataset.bracketSide));
  });

  document.querySelectorAll("[data-bracket-row]").forEach((row) => {
    row.addEventListener("dragstart", (event) => {
      event.dataTransfer.setData("text/plain", row.dataset.index || [...row.parentElement.children].indexOf(row));
      row.classList.add("dragging");
    });
    row.addEventListener("dragend", () => row.classList.remove("dragging"));
    row.addEventListener("dragover", (event) => event.preventDefault());
    row.addEventListener("drop", (event) => {
      event.preventDefault();
      const rows = [...row.parentElement.querySelectorAll("[data-bracket-row]")];
      const from = Number(event.dataTransfer.getData("text/plain"));
      const to = rows.indexOf(row);
      if (Number.isNaN(from) || to < 0 || from === to) return;
      const sessionId = founderSessionId();
      const brackets = getCustomBrackets();
      const next = readBracketRows();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      brackets[sessionId] = next.map((item, index) => ({ ...item, id: `m${index + 1}` }));
      saveCustomBrackets(brackets);
      render();
    });
  });

  document.querySelector("[data-action='save-group-rules']")?.addEventListener("click", () => {
    const sessionId = founderSessionId();
    const rules = getGroupRules();
    rules[sessionId] = rules[sessionId] || {};
    saveGroupRules(rules);
    render();
  });

  document.querySelector("[data-action='copy-bracket-to-groups']")?.addEventListener("click", () => {
    const sessionId = founderSessionId();
    const rules = getGroupRules();
    const rows = readBracketRows();
    rules[sessionId] = Object.fromEntries(ageRanges.map((range) => [range, cloneBattleItems(rows)]));
    saveGroupRules(rules);
    render();
  });

  document.querySelector("[data-action='clear-group-rules']")?.addEventListener("click", () => {
    const sessionId = founderSessionId();
    const rules = getGroupRules();
    delete rules[sessionId];
    saveGroupRules(rules);
    render();
  });

  document.querySelectorAll("[data-action='assign-current-bracket']").forEach((button) => {
    button.addEventListener("click", () => {
      const sessionId = founderSessionId();
      const rules = getGroupRules();
      rules[sessionId] = rules[sessionId] || {};
      rules[sessionId][button.dataset.age] = cloneBattleItems(readBracketRows());
      saveGroupRules(rules);
      render();
    });
  });

  document.querySelectorAll("[data-action='clear-age-rule']").forEach((button) => {
    button.addEventListener("click", () => {
      const sessionId = founderSessionId();
      const rules = getGroupRules();
      if (rules[sessionId]) delete rules[sessionId][button.dataset.age];
      saveGroupRules(rules);
      render();
    });
  });

  document.querySelector("[data-action='comparison-mode']")?.addEventListener("change", (event) => {
    localStorage.setItem(comparisonModeKey, event.target.checked ? "on" : "off");
    render();
  });

  document.querySelector("[data-action='save-image-settings']")?.addEventListener("click", () => {
    saveImageSettings(readImageControlRows());
    render();
  });

  document.querySelector("[data-action='reset-image-settings']")?.addEventListener("click", () => {
    if (confirm("Reset all image crop, description, and harmonisation settings?")) {
      localStorage.removeItem(imageSettingsKey);
      localStorage.removeItem(comparisonModeKey);
      render();
    }
  });

  document.querySelectorAll("[data-image-control] input[type='range']").forEach((input) => {
    input.addEventListener("input", () => updateControlPreview(input.closest("[data-image-control]")));
  });

  document.querySelectorAll("[data-aspect]").forEach((button) => {
    button.addEventListener("click", () => {
      const card = button.closest("[data-image-control]");
      card.querySelectorAll("[data-aspect]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      updateControlPreview(card);
    });
  });

  document.querySelectorAll("[data-crop-stage]").forEach((stage) => {
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startCropX = 50;
    let startCropY = 50;

    const card = stage.closest("[data-image-control]");
    const xInput = card.querySelector("[data-image-field='x']");
    const yInput = card.querySelector("[data-image-field='y']");

    stage.addEventListener("pointerdown", (event) => {
      dragging = true;
      startX = event.clientX;
      startY = event.clientY;
      startCropX = Number(xInput.value);
      startCropY = Number(yInput.value);
      stage.setPointerCapture(event.pointerId);
      stage.classList.add("is-dragging");
    });

    stage.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      const rect = stage.getBoundingClientRect();
      const deltaX = ((event.clientX - startX) / rect.width) * 100;
      const deltaY = ((event.clientY - startY) / rect.height) * 100;
      xInput.value = clamp(startCropX - deltaX, 0, 100);
      yInput.value = clamp(startCropY - deltaY, 0, 100);
      updateControlPreview(card);
    });

    stage.addEventListener("pointerup", (event) => {
      dragging = false;
      stage.releasePointerCapture(event.pointerId);
      stage.classList.remove("is-dragging");
    });

    stage.addEventListener("pointercancel", () => {
      dragging = false;
      stage.classList.remove("is-dragging");
    });
  });
}

function readBracketRows() {
  return [...document.querySelectorAll("[data-bracket-row]")]
    .map((row, index) => {
      const left = row.querySelector("[data-bracket-side='left']").value;
      const right = row.querySelector("[data-bracket-side='right']").value;
      return {
        id: row.querySelector("[data-route-field='id']")?.value || `m${index + 1}`,
        pair: [left, right],
        leftNext: row.querySelector("[data-route-field='leftNext']")?.value || "next",
        rightNext: row.querySelector("[data-route-field='rightNext']")?.value || "next"
      };
    })
    .filter((item) => item.pair[0] && item.pair[1] && item.pair[0] !== item.pair[1])
    .map((item, index, items) => ({
      ...item,
      id: `m${index + 1}`,
      leftNext: normaliseRoute(item.leftNext, index, items.length),
      rightNext: normaliseRoute(item.rightNext, index, items.length)
    }));
}

function normaliseRoute(route, index, total) {
  if (route === "end") return "end";
  if (route === "next") return index + 1 < total ? `m${index + 2}` : "end";
  return route;
}

function cloneBattleItems(items) {
  return items.map((item) => Array.isArray(item)
    ? [...item]
    : {
        ...item,
        pair: [...item.pair]
      });
}

function readImageControlRows() {
  const settings = {};
  document.querySelectorAll("[data-image-control]").forEach((card) => {
    const id = card.dataset.imageControl;
    const field = (name) => card.querySelector(`[data-image-field='${name}']`);
    settings[id] = {
      x: Number(field("x").value),
      y: Number(field("y").value),
      zoom: Number(field("zoom").value),
      snipX: Number(field("snipX").value),
      snipY: Number(field("snipY").value),
      aspect: card.querySelector("[data-aspect].active")?.dataset.aspect || "1:1",
      description: field("description").value.slice(0, 30),
      harmonise: field("harmonise").checked
    };
  });
  return settings;
}

function updateControlPreview(card) {
  if (!card) return;
  const preview = card.querySelector(".control-preview");
  const x = card.querySelector("[data-image-field='x']").value;
  const y = card.querySelector("[data-image-field='y']").value;
  const zoom = card.querySelector("[data-image-field='zoom']").value;
  const snipX = card.querySelector("[data-image-field='snipX']").value;
  const snipY = card.querySelector("[data-image-field='snipY']").value;
  const aspect = card.querySelector("[data-aspect].active")?.dataset.aspect || "1:1";
  const stage = card.querySelector("[data-crop-stage]");
  preview.style.setProperty("--image-x", `${x}%`);
  preview.style.setProperty("--image-y", `${y}%`);
  preview.style.setProperty("--image-zoom", `${zoom}%`);
  preview.style.setProperty("--image-scale", `${Number(zoom) / 100}`);
  preview.style.setProperty("--snip-x", `${snipX}%`);
  preview.style.setProperty("--snip-y", `${snipY}%`);
  preview.style.setProperty("--crop-aspect", aspectValue(aspect));
  stage.style.setProperty("--snip-x", `${snipX}%`);
  stage.style.setProperty("--snip-y", `${snipY}%`);
  stage.style.setProperty("--crop-aspect", aspectValue(aspect));
}

function updateBracketThumb(row, side) {
  const id = row.querySelector(`[data-bracket-side='${side}']`).value;
  const design = findDesign(id);
  const thumb = row.querySelector(`[data-thumb-side='${side}']`);
  if (!design || !thumb) return;
  thumb.src = design.image;
  thumb.alt = design.name;
  thumb.setAttribute("style", imageStyle(design));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toggle(list, id) {
  const index = list.indexOf(id);
  if (index >= 0) list.splice(index, 1);
  else list.push(id);
}

function moveRank(index, direction) {
  const next = index + direction;
  if (next < 0 || next >= review.ranking.length) return;
  const copy = [...review.ranking];
  const item = copy[index];
  copy[index] = copy[next];
  copy[next] = item;
  review.ranking = copy;
}

render();
