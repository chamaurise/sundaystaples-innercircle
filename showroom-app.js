const config = window.SUNDAY_CIRCLE_CONFIG || {};
const sourceConcepts = config.concepts || [];
const app = document.querySelector("#app");
const storeKey = "sunday-showroom-v1";
const windowStorePrefix = "sunday-showroom-state:";

const defaultTags = ["Tag 1", "Tag 2", "Tag 3"];
const actionChoices = ["Launch as is", "Launch in another colour", "Tweak the shape", "Change the material", "Lower the price", "Market it differently", "Drop it"];
const occasionChoices = ["Work", "Weekend", "Dinner", "Wedding / event", "Holiday", "Daily errands", "I would not wear this"];
const defaultProfileQuestions = [
  { key: "ageRange", label: "Age range", options: ["Under 25", "25-34", "35-44", "45-54", "55+"], multiple: false },
  { key: "shoePreference", label: "Usual shoe preference", options: ["Flats", "Heels", "Sandals", "Sneakers", "Boots"], multiple: true },
  { key: "stylePreference", label: "Style preference", options: ["Classic", "Feminine", "Minimal", "Bold", "Trend-led"], multiple: true },
  { key: "purchaseFrequency", label: "How often do you buy shoes?", options: ["Monthly", "Quarterly", "A few times a year", "Only when needed"], multiple: false },
  { key: "priceComfort", label: "Comfortable price range", options: ["Under $80", "$80-$120", "$120-$160", "$160-$220", "$220+"], multiple: false }
];
const defaultSurveyCopy = {
  profileHeading: "First, help us understand your style.",
  profileHint: "Choose one answer per row. This helps Sunday Staples compare feedback across different customer groups.",
  profileStartButton: "Start design review"
};
const priceDriverChoices = ["Excellent value", "Fair for the design", "Too expensive", "Would wait for a promo", "Depends on material quality"];
const firstImpressionDrivers = [
  "More beautiful shape",
  "Better colour",
  "Easier to style",
  "Looks more comfortable",
  "Better for a specific occasion"
];
const backendTabs = [
  { id: "overview", label: "Overview", helper: "Snapshot" },
  { id: "repository", label: "Repository", helper: "Upload & crop" },
  { id: "profile", label: "Profile", helper: "Segments" },
  { id: "first", label: "First Impressions", helper: "Head-to-head" },
  { id: "purchase", label: "Purchase Intent", helper: "Rank 1-5" },
  { id: "occasion", label: "Occasion Fit", helper: "Use cases" },
  { id: "price", label: "Price & Value", helper: "Price sliders" },
  { id: "action", label: "Founder Action", helper: "Decisions" },
  { id: "results", label: "Results", helper: "Live readout" }
];

let view = "backend";
let backendTab = "overview";
let customerStep = "profile";
let customerRound = 0;
let customerMatch = 0;
let purchaseRound = 0;
let priceIndex = 0;
let memoryState = null;
let state = loadState();
let draftResponse = freshResponse();
let saveNotice = "";

function storageGet(key) {
  try {
    const local = window.localStorage.getItem(key);
    if (local) return local;
  } catch (error) {
    // Some file:// previews block localStorage. window.name survives refresh in the same tab.
  }
  if (String(window.name || "").startsWith(windowStorePrefix)) {
    return window.name.slice(windowStorePrefix.length);
  }
  return null;
}

function storageSet(key, value) {
  window.name = `${windowStorePrefix}${value}`;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (error) {
    memoryState = value;
    return false;
  }
}

function storageRemove(key) {
  if (String(window.name || "").startsWith(windowStorePrefix)) window.name = "";
  try {
    window.localStorage.removeItem(key);
  } catch (error) {
    memoryState = null;
  }
}

function seedAssets() {
  return sourceConcepts.map((concept, index) => ({
    id: concept.id,
    name: concept.name || `Concept ${index + 1}`,
    category: concept.style || "Shoe concept",
    material: concept.material || "To be confirmed",
    rrp: Number(String(concept.price || "159").replace(/[^0-9.]/g, "")) || 159,
    tags: [defaultTags[index % defaultTags.length]],
    image: concept.image,
    crop: { x: 50, y: 50, zoom: 100, left: 8, top: 8, width: 84, height: 84, aspect: "1:1" }
  }));
}

function defaultState() {
  const assets = seedAssets();
  return {
    assets,
    showroom: {
      profileQuestions: cloneProfileQuestions(defaultProfileQuestions),
      copy: { ...defaultSurveyCopy },
      firstTags: [...defaultTags],
      firstRounds: defaultTags.map((tag) => assets.filter((asset) => asset.tags.includes(tag)).map((asset) => asset.id)),
      purchaseRounds: defaultTags.map((tag) => assets.filter((asset) => asset.tags.includes(tag)).slice(0, 5).map((asset) => asset.id)),
      occasionItems: assets.slice(0, 5).map((asset) => asset.id),
      priceItems: assets.slice(0, 5).map((asset) => ({ id: asset.id, startPrice: asset.rrp || 159 })),
      actionItems: assets.slice(0, 5).map((asset) => asset.id)
    },
    responses: []
  };
}

function loadState() {
  try {
    const saved = JSON.parse(storageGet(storeKey) || memoryState || "null");
    if (saved?.assets?.length) return normaliseState(saved);
  } catch (error) {
    storageRemove(storeKey);
  }
  return defaultState();
}

function normaliseState(saved) {
  const fallback = defaultState();
  saved.showroom = saved.showroom || {};
  saved.showroom.profileQuestions = normaliseProfileQuestions(saved.showroom.profileQuestions);
  saved.showroom.copy = { ...defaultSurveyCopy, ...(saved.showroom.copy || {}) };
  saved.showroom.firstTags = saved.showroom.firstTags || fallback.showroom.firstTags;
  saved.showroom.firstRounds = normaliseFirstRounds(saved.showroom.firstRounds, saved.showroom.firstTags, saved.assets);
  saved.showroom.purchaseRounds = saved.showroom.purchaseRounds || fallback.showroom.purchaseRounds;
  saved.showroom.occasionItems = saved.showroom.occasionItems || saved.showroom.priceItems?.map((item) => item.id) || fallback.showroom.occasionItems;
  saved.showroom.priceItems = saved.showroom.priceItems || fallback.showroom.priceItems;
  saved.showroom.actionItems = saved.showroom.actionItems || saved.showroom.occasionItems || fallback.showroom.actionItems;
  saved.responses = (saved.responses || []).map((response) => ({
    profile: response.profile || {},
    firstImpressions: response.firstImpressions || [],
    purchaseIntent: response.purchaseIntent || [],
    occasionFit: response.occasionFit || [],
    priceValue: response.priceValue || [],
    founderAction: response.founderAction || [],
    completedAt: response.completedAt || null
  }));
  return saved;
}

function cloneProfileQuestions(questions) {
  return questions.map((question) => ({
    key: question.key,
    label: question.label,
    options: [...question.options],
    multiple: Boolean(question.multiple)
  }));
}

function normaliseProfileQuestions(questions) {
  const fallback = cloneProfileQuestions(defaultProfileQuestions);
  if (!Array.isArray(questions) || !questions.length) return fallback;
  return fallback.map((defaultQuestion, index) => {
    const saved = questions[index] || {};
    const options = Array.isArray(saved.options) ? saved.options.filter(Boolean) : defaultQuestion.options;
    return {
      key: defaultQuestion.key,
      label: String(saved.label || defaultQuestion.label).trim(),
      options: options.length ? options : defaultQuestion.options,
      multiple: Boolean(defaultQuestion.multiple)
    };
  });
}

function profileQuestionSet() {
  state.showroom.profileQuestions = normaliseProfileQuestions(state.showroom.profileQuestions);
  return state.showroom.profileQuestions;
}

function primaryProfileKey() {
  return profileQuestionSet()[0]?.key || "ageRange";
}

function surveyCopy() {
  state.showroom.copy = { ...defaultSurveyCopy, ...(state.showroom.copy || {}) };
  return state.showroom.copy;
}

function normaliseFirstRounds(rounds, tags = defaultTags, assets = state.assets) {
  const assetIds = new Set((assets || []).map((asset) => asset.id));
  if (Array.isArray(rounds) && rounds.length) {
    return [0, 1, 2].map((index) => uniqueIds(rounds[index] || []).filter((id) => assetIds.has(id)));
  }
  return [0, 1, 2].map((index) => {
    const tag = tags[index] || defaultTags[index];
    return assets
      .filter((asset) => tagsFor(asset).map((item) => item.toLowerCase()).includes(String(tag).toLowerCase()))
      .map((asset) => asset.id);
  });
}

function saveState() {
  syncPriceItemsWithAssets();
  storageSet(storeKey, JSON.stringify(state));
}

function syncPriceItemsWithAssets() {
  state.showroom.priceItems = state.showroom.priceItems
    .map((item) => {
      const asset = assetById(item.id);
      if (!asset) return null;
      return { ...item, startPrice: Number(asset.rrp) || Number(item.startPrice) || 159 };
    })
    .filter(Boolean);
}

function freshResponse() {
  return {
    profile: {},
    firstImpressions: [],
    purchaseIntent: [],
    occasionFit: [],
    priceValue: [],
    founderAction: [],
    completedAt: null
  };
}

function assetById(id) {
  return state.assets.find((asset) => asset.id === id);
}

function imageStyle(asset) {
  const crop = normaliseCrop(asset);
  const right = Math.max(0, 100 - crop.left - crop.width);
  const bottom = Math.max(0, 100 - crop.top - crop.height);
  return `--image-x:${crop.x}%;--image-y:${crop.y}%;--image-zoom:${crop.zoom}%;--crop-left:${crop.left}%;--crop-top:${crop.top}%;--crop-width:${crop.width}%;--crop-height:${crop.height}%;--clip-top:${crop.top}%;--clip-right:${right}%;--clip-bottom:${bottom}%;--clip-left:${crop.left}%;`;
}

function thumbnailStyle(asset) {
  return `${imageStyle(asset)}--thumb-url:url("${escapeCssUrl(asset.image)}");`;
}

function escapeCssUrl(value) {
  return String(value || "").replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function normaliseCrop(asset) {
  return {
    x: Number(asset?.crop?.x ?? 50),
    y: Number(asset?.crop?.y ?? 50),
    zoom: Number(asset?.crop?.zoom ?? 100),
    left: Number(asset?.crop?.left ?? 8),
    top: Number(asset?.crop?.top ?? 8),
    width: Number(asset?.crop?.width ?? 84),
    height: Number(asset?.crop?.height ?? 84),
    aspect: String(asset?.crop?.aspect || "1:1")
  };
}

function tagsFor(asset) {
  return Array.isArray(asset.tags) ? asset.tags : [];
}

function render() {
  app.innerHTML = `
    <div class="shell ${view === "preview" ? "preview-shell" : ""}">
      <header class="topbar">
        <div class="brand">
          <span class="brand-mark">SS</span>
          <div>
            <strong>AI-powered Closed Feedback Loop System</strong>
            <span>${view === "backend" ? "Admin builder" : "Preview"}</span>
          </div>
        </div>
        <nav class="nav">
          <button class="${view === "backend" ? "active" : ""}" data-view="backend">Admin</button>
          <button class="${view === "preview" ? "active" : ""}" data-view="preview">Preview</button>
        </nav>
      </header>
      ${view === "backend" ? backendScreen() : previewScreen()}
    </div>
  `;
  bindEvents();
}

function backendScreen() {
  const content = {
    overview: overviewSection(),
    repository: repositorySection(),
    profile: profileSection(),
    first: firstImpressionsSection(),
    purchase: purchaseIntentSection(),
    occasion: occasionFitSection(),
    price: priceValueSection(),
    action: founderActionSection(),
    results: resultsSection()
  }[backendTab] || overviewSection();
  return `
    <main class="backend">
      <div class="backend-layout">
        ${backendSidebar()}
        <div class="backend-content">
          ${content}
        </div>
      </div>
    </main>
  `;
}

function backendSidebar() {
  const complete = setupCompletion();
  return `
    <aside class="backend-sidebar">
      <div class="sidebar-card">
        <p class="eyebrow">Survey setup</p>
        <h2>${complete}% ready</h2>
        <div class="setup-meter" style="--ready:${complete}%"><span></span></div>
      </div>
      <nav class="backend-tabs">
        ${backendTabs.map((tab) => `
          <button class="${backendTab === tab.id ? "active" : ""}" data-backend-tab="${tab.id}">
            <strong>${tab.label}</strong>
            <span>${tab.helper}</span>
          </button>
        `).join("")}
      </nav>
    </aside>
  `;
}

function overviewSection() {
  const matchCount = firstImpressionMatches().length;
  const purchaseSlots = state.showroom.purchaseRounds.reduce((sum, round) => sum + round.length, 0);
  return `
    <section class="hero-panel">
      <div>
        <p class="eyebrow">Admin reset</p>
        <h1>Design Showroom Builder</h1>
        <p class="lede">Upload and prepare concepts once, then structure a guided research session across profile, launch excitement, purchase intent, occasion fit, value, and founder action.</p>
      </div>
      <div class="metrics">
        <div><strong>${state.assets.length}</strong><span>concepts</span></div>
        <div><strong>${matchCount}</strong><span>head-to-head matches</span></div>
        <div><strong>${purchaseSlots}</strong><span>ranking slots</span></div>
        <div><strong>${state.responses.length}</strong><span>completed sessions</span></div>
      </div>
    </section>
    <section class="panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">Recommended flow</p>
          <h2>Build the showroom in this order</h2>
        </div>
      </div>
      <div class="workflow-grid">
        ${backendTabs.slice(1, 8).map((tab, index) => `
          <button data-backend-tab="${tab.id}">
            <span>0${index + 1}</span>
            <strong>${tab.label}</strong>
            <small>${tab.helper}</small>
          </button>
        `).join("")}
      </div>
    </section>
    ${resultsSection()}
  `;
}

function setupCompletion() {
  let score = 0;
  if (state.assets.length) score += 25;
  if (firstImpressionMatches().length >= 12) score += 20;
  if (state.showroom.purchaseRounds.every((round) => round.length === 5)) score += 20;
  if (state.showroom.occasionItems.length) score += 15;
  if (state.showroom.priceItems.length) score += 10;
  if (state.showroom.actionItems.length) score += 10;
  return score;
}

function repositorySection() {
  return `
    <section class="panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">Central repository</p>
          <h2>Upload, crop, label, price, and tag concepts</h2>
        </div>
      </div>
      <label class="drop-zone" data-drop-zone>
        <input type="file" accept="image/*" multiple data-action="upload-assets" />
        <strong>Drop shoe images here</strong>
        <span>or click to upload multiple files at once. Images appear below as compact thumbnails.</span>
        <em>Open file picker</em>
      </label>
      <div class="repository-toolbar">
        <strong>${state.assets.length} concepts in repository</strong>
        <span>${saveNotice || "Tip: drag inside the crop box to position the snip."}</span>
      </div>
      <div class="asset-grid">
        ${state.assets.map(assetCard).join("")}
      </div>
      <div class="button-row">
        <button class="primary-button" data-action="save-repository">Save Changes</button>
        <button class="ghost-button" data-view="preview">Open Preview</button>
      </div>
    </section>
  `;
}

function assetCard(asset) {
  return `
    <article class="asset-card" data-asset="${asset.id}">
      <div class="asset-image" data-drag-crop style="${thumbnailStyle(asset)}">
        <img src="${asset.image}" alt="${escapeAttribute(asset.name)}" onload="this.closest('.asset-image').classList.add('image-ready')" onerror="this.closest('.asset-image').classList.add('missing-image')" />
        <div class="repo-crop-frame" data-crop-box>
          <span data-crop-handle="move"></span>
          <span data-crop-handle="nw"></span>
          <span data-crop-handle="ne"></span>
          <span data-crop-handle="sw"></span>
          <span data-crop-handle="se"></span>
          <span data-crop-handle="n"></span>
          <span data-crop-handle="s"></span>
          <span data-crop-handle="e"></span>
          <span data-crop-handle="w"></span>
        </div>
        <b>No preview</b>
      </div>
      <div class="asset-fields">
        <label>Name<input data-field="name" value="${escapeAttribute(asset.name)}" /></label>
        <label>Category<input data-field="category" value="${escapeAttribute(asset.category)}" /></label>
        <label>Material<input data-field="material" value="${escapeAttribute(asset.material)}" /></label>
        <label>RRP $<input data-field="rrp" type="number" min="1" step="1" value="${asset.rrp}" /></label>
        <label>Zoom<input data-field="zoom" type="range" min="80" max="180" value="${normaliseCrop(asset).zoom}" /></label>
        <label>Tags<input data-field="tags" value="${escapeAttribute(tagsFor(asset).join(", "))}" placeholder="Tag 1, bridal, mesh" /></label>
        <div class="crop-presets">
          ${["1:1", "4:6", "6:4", "4:5"].map((aspect) => `<button type="button" class="${normaliseCrop(asset).aspect === aspect ? "active" : ""}" data-crop-aspect="${aspect}">${aspect}</button>`).join("")}
        </div>
      </div>
    </article>
  `;
}

function profileSection() {
  const copy = surveyCopy();
  return `
    <section class="panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">Participant profile</p>
          <h2>Customise the profile questions</h2>
          <p class="hint">Edit the wording and answer choices shown at the start of the customer session. Keep answers short so participants can move quickly.</p>
        </div>
      </div>
      <div class="profile-copy-card">
        <label>Step 1 heading
          <input data-copy-field="profileHeading" value="${escapeAttribute(copy.profileHeading)}" />
        </label>
        <label>Step 1 helper text
          <textarea data-copy-field="profileHint" rows="3">${escapeAttribute(copy.profileHint)}</textarea>
        </label>
        <label>Step 1 start button
          <input data-copy-field="profileStartButton" value="${escapeAttribute(copy.profileStartButton)}" />
        </label>
      </div>
      <div class="profile-editor-list">
        ${profileQuestionSet().map(profileEditorCard).join("")}
      </div>
      <div class="button-row">
        <button class="primary-button" data-action="save-backend">Save profile questions</button>
        <button class="ghost-button" data-action="reset-profile-questions">Reset to recommended template</button>
      </div>
    </section>
  `;
}

function profileEditorCard(question, index) {
  return `
    <article class="profile-editor-card" data-profile-question="${index}">
      <label>Question ${index + 1}
        <input data-profile-label="${index}" value="${escapeAttribute(question.label)}" />
      </label>
      <label>Answer choices
        <textarea data-profile-options="${index}" rows="3">${escapeAttribute(question.options.join("\n"))}</textarea>
        <span>Put each option on a new line. ${question.multiple ? "Participants may choose more than one answer for this question." : "Participants choose one answer for this question."}</span>
      </label>
    </article>
  `;
}

function firstImpressionsSection() {
  state.showroom.firstRounds = normaliseFirstRounds(state.showroom.firstRounds, state.showroom.firstTags, state.assets);
  return `
    <section class="panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">2. First Impressions</p>
          <h2>Head-to-head comparisons</h2>
          <p class="hint">Choose concepts from the full repository for Round 1, Round 2, and Round 3. Each round creates up to four head-to-head matches.</p>
        </div>
      </div>
      <div class="purchase-builder">
        ${state.showroom.firstRounds.map((round, index) => firstRoundBuilder(round, index)).join("")}
      </div>
      <div class="match-preview">
        ${firstImpressionMatches().slice(0, 12).map((match, index) => matchupCard(match, index)).join("")}
      </div>
      <div class="button-row">
        <button class="primary-button" data-action="save-backend">Save showroom setup</button>
      </div>
    </section>
  `;
}

function firstRoundBuilder(round, index) {
  return `
    <article class="round-builder">
      <h3>First Impressions Round ${index + 1}</h3>
      <p class="hint">${round.length} selected. Select at least 2 concepts to create matches.</p>
      <div class="select-grid">
        ${state.assets.map((asset) => `
          <label class="select-tile ${round.includes(asset.id) ? "selected" : ""}">
            <input type="checkbox" data-first-round="${index}" value="${asset.id}" ${round.includes(asset.id) ? "checked" : ""} />
            <img style="${imageStyle(asset)}" src="${asset.image}" alt="${escapeAttribute(asset.name)}" />
            <span>${asset.name}</span>
          </label>
        `).join("")}
      </div>
    </article>
  `;
}

function matchupCard(match, index) {
  const left = assetById(match.left);
  const right = assetById(match.right);
  if (!left || !right) return "";
  return `
    <div class="match-card">
      <span>Match ${index + 1} - ${match.tag}</span>
      <div>
        <img style="${imageStyle(left)}" src="${left.image}" alt="${escapeAttribute(left.name)}" />
        <strong>vs</strong>
        <img style="${imageStyle(right)}" src="${right.image}" alt="${escapeAttribute(right.name)}" />
      </div>
    </div>
  `;
}

function purchaseIntentSection() {
  return `
    <section class="panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">3. Purchase Intent</p>
          <h2>Choose three rounds of five designs</h2>
          <p class="hint">Customers drag thumbnails into a 1-to-5 purchase ranking. #1 means most likely to buy.</p>
        </div>
      </div>
      <div class="purchase-builder">
        ${state.showroom.purchaseRounds.map((round, index) => purchaseRoundBuilder(round, index)).join("")}
      </div>
    </section>
  `;
}

function purchaseRoundBuilder(round, index) {
  return `
    <article class="round-builder">
      <h3>Ranking Round ${index + 1}</h3>
      <div class="select-grid">
        ${state.assets.map((asset) => `
          <label class="select-tile ${round.includes(asset.id) ? "selected" : ""}">
            <input type="checkbox" data-purchase-round="${index}" value="${asset.id}" ${round.includes(asset.id) ? "checked" : ""} ${round.length >= 5 && !round.includes(asset.id) ? "disabled" : ""} />
            <img style="${imageStyle(asset)}" src="${asset.image}" alt="${escapeAttribute(asset.name)}" />
            <span>${asset.name}</span>
          </label>
        `).join("")}
      </div>
    </article>
  `;
}

function occasionFitSection() {
  return `
    <section class="panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">4. Occasion Fit</p>
          <h2>Select designs to test for use cases</h2>
          <p class="hint">Customers choose where they would most likely wear each design. This helps with merchandising, product naming, and campaign angles.</p>
        </div>
      </div>
      <div class="price-builder">
        ${state.assets.map((asset) => selectionRow(asset, "occasion", state.showroom.occasionItems.includes(asset.id))).join("")}
      </div>
    </section>
  `;
}

function priceValueSection() {
  return `
    <section class="panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">5. Price & Value</p>
          <h2>Select designs and starting prices</h2>
          <p class="hint">Customers set a good-value price and a too-expensive threshold, giving you a practical pricing range.</p>
        </div>
      </div>
      <div class="price-builder">
        ${state.assets.map(priceBuilderRow).join("")}
      </div>
    </section>
  `;
}

function founderActionSection() {
  return `
    <section class="panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">6. Founder Action</p>
          <h2>Select designs for launch decisions</h2>
          <p class="hint">Customers give a direct recommendation: launch, recolour, tweak, reprice, remarket, or drop.</p>
        </div>
      </div>
      <div class="price-builder">
        ${state.assets.map((asset) => selectionRow(asset, "action", state.showroom.actionItems.includes(asset.id))).join("")}
      </div>
    </section>
  `;
}

function selectionRow(asset, type, selected) {
  return `
    <label class="price-row ${selected ? "selected" : ""}">
      <input type="checkbox" data-${type}-enabled="${asset.id}" ${selected ? "checked" : ""} />
      <img style="${imageStyle(asset)}" src="${asset.image}" alt="${escapeAttribute(asset.name)}" />
      <span>${asset.name}</span>
      <small>${asset.category} - RRP $${asset.rrp}</small>
    </label>
  `;
}

function priceBuilderRow(asset) {
  const item = state.showroom.priceItems.find((priceItem) => priceItem.id === asset.id);
  return `
    <label class="price-row ${item ? "selected" : ""}">
      <input type="checkbox" data-price-enabled="${asset.id}" ${item ? "checked" : ""} />
      <img style="${imageStyle(asset)}" src="${asset.image}" alt="${escapeAttribute(asset.name)}" />
      <span>${asset.name}</span>
      <input type="number" min="1" step="1" data-price-start="${asset.id}" value="${item?.startPrice || asset.rrp}" />
    </label>
  `;
}

function resultsSection() {
  const analytics = buildShowroomAnalytics();
  return `
    <section class="panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">Data scientist readout</p>
          <h2>Which shoes are winning, and why?</h2>
          <p class="hint">Combines profile, launch excitement, purchase ranking, occasion fit, price confidence, and founder action into one decision view.</p>
        </div>
      </div>
      <div class="results-grid">
        <div><strong>${analytics.responses}</strong><span>Completed previews</span></div>
        <div><strong>${analytics.leaders.overall?.name || "-"}</strong><span>Strongest overall</span></div>
        <div><strong>${analytics.leaders.first?.name || "-"}</strong><span>First-impression winner</span></div>
        <div><strong>${analytics.leaders.purchase?.name || "-"}</strong><span>Most sellable</span></div>
        <div><strong>${analytics.leaders.action?.name || "-"}</strong><span>Clearest launch action</span></div>
        <div><strong>${analytics.leaders.occasion?.name || "-"}</strong><span>Strongest occasion fit</span></div>
      </div>
      <div class="standout-panel">
        <div class="section-head">
          <div>
            <h3>Standout shoe previews</h3>
            <p class="hint">A visual shortlist of the designs that stood out across the research signals.</p>
          </div>
        </div>
        <div class="standout-grid">
          ${standoutShoes(analytics).map(standoutCard).join("") || `<div class="empty-row">No standout shoes yet. Complete Preview responses to populate this gallery.</div>`}
        </div>
      </div>
      <div class="insight-panel">
        <h3>Strongest conclusions</h3>
        ${analytics.conclusions.map((line) => `<p>${line}</p>`).join("") || `<p>Complete at least one Preview response to generate conclusions.</p>`}
      </div>
      <div class="analytics-table">
        <div class="analytics-row analytics-head">
          <strong>Design</strong>
          <strong>Overall</strong>
          <strong>Votes</strong>
          <strong>Why it won</strong>
          <strong>Purchase</strong>
          <strong>Price</strong>
          <strong>Occasion</strong>
          <strong>Action</strong>
        </div>
        ${analytics.rows.map(resultAnalyticsRow).join("") || `<div class="empty-row">No responses yet. Use Preview to create test data.</div>`}
      </div>
      <div class="button-row">
        <button class="ghost-button" data-action="clear-responses">Clear preview responses</button>
      </div>
    </section>
  `;
}

function standoutShoes(analytics) {
  const candidates = [
    ["Overall winner", analytics.leaders.overall],
    ["First-impression winner", analytics.leaders.first],
    ["Most sellable", analytics.leaders.purchase],
    ["Best price confidence", analytics.leaders.price],
    ["Strongest occasion fit", analytics.leaders.occasion],
    ["Clearest founder action", analytics.leaders.action],
    ...analytics.rows.slice(0, 4).map((row, index) => [`Top ${index + 1} overall`, row])
  ];
  const byId = new Map();
  candidates.forEach(([badge, row]) => {
    if (!row) return;
    const current = byId.get(row.id) || { row, badges: [] };
    if (!current.badges.includes(badge)) current.badges.push(badge);
    byId.set(row.id, current);
  });
  return [...byId.values()].slice(0, 8);
}

function standoutCard(item) {
  const row = item.row;
  return `
    <article class="standout-card">
      <img style="${imageStyle(row.asset)}" src="${row.asset.image}" alt="${escapeAttribute(row.name)}" />
      <div>
        <strong>${row.name}</strong>
        <span>${row.asset.category} - RRP $${row.asset.rrp}</span>
      </div>
      <div class="standout-badges">
        ${item.badges.slice(0, 3).map((badge) => `<small>${badge}</small>`).join("")}
      </div>
      <p>${row.topDriver || row.topAction || row.topOccasion || "Standout design"}</p>
    </article>
  `;
}

function resultAnalyticsRow(row) {
  return `
    <div class="analytics-row">
      <div class="analytics-design">
        <img style="${imageStyle(row.asset)}" src="${row.asset.image}" alt="${escapeAttribute(row.name)}" />
        <div>
          <strong>${row.name}</strong>
          <span>${row.asset.category} · $${row.asset.rrp}</span>
        </div>
      </div>
      <div><strong>${row.score}</strong><span>weighted score</span></div>
      <div><strong>${row.firstVotes}</strong><span>${row.firstShare}% of preference votes</span></div>
      <div><strong>${row.topDriver || "-"}</strong><span>${driverSummary(row)}</span></div>
      <div><strong>${row.topOneCount}</strong><span>avg rank ${row.averageRank || "-"}</span></div>
      <div><strong>${row.averageAcceptedPrice ? `$${row.averageAcceptedPrice}` : "-"}</strong><span>${row.priceRetention ? `${row.priceRetention}% of RRP; too high near $${row.averageTooExpensivePrice}` : "no price data"}</span></div>
      <div><strong>${row.topOccasion || "-"}</strong><span>${summaryFromCounts(row.occasions, "No occasion data")}</span></div>
      <div><strong>${row.topAction || "-"}</strong><span>${summaryFromCounts(row.actions, "No action data")}</span></div>
    </div>
  `;
}

function driverSummary(row) {
  const entries = Object.entries(row.drivers).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return "No reason captured yet";
  return entries.slice(0, 2).map(([driver, count]) => `${driver} (${count})`).join(", ");
}

function summaryFromCounts(counts, fallback) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return fallback;
  return entries.slice(0, 2).map(([label, count]) => `${label} (${count})`).join(", ");
}

function buildShowroomAnalytics() {
  const rowsById = {};
  state.assets.forEach((asset) => {
    rowsById[asset.id] = {
      id: asset.id,
      asset,
      name: asset.name,
      firstVotes: 0,
      firstShare: 0,
      drivers: {},
      topDriver: "",
      purchaseScore: 0,
      topOneCount: 0,
      rankCount: 0,
      rankTotal: 0,
      averageRank: "",
      priceTotal: 0,
      tooExpensiveTotal: 0,
      priceCount: 0,
      retentionTotal: 0,
      priceRetention: 0,
      averageAcceptedPrice: 0,
      averageTooExpensivePrice: 0,
      occasions: {},
      topOccasion: "",
      actions: {},
      topAction: "",
      segments: {},
      topSegment: "",
      score: 0
    };
  });

  const responses = state.responses || [];
  let totalPreferenceVotes = 0;

  responses.forEach((response) => {
    (response.firstImpressions || []).forEach((item) => {
      const row = rowsById[item.winner];
      if (!row) return;
      row.firstVotes += 1;
      totalPreferenceVotes += 1;
      if (item.driver) row.drivers[item.driver] = (row.drivers[item.driver] || 0) + 1;
      const primarySegment = response.profile?.[primaryProfileKey()];
      if (primarySegment) row.segments[primarySegment] = (row.segments[primarySegment] || 0) + 1;
    });

    (response.purchaseIntent || []).forEach((round) => {
      (round.ranking || []).forEach((id, index) => {
        const row = rowsById[id];
        if (!row) return;
        const rank = index + 1;
        row.purchaseScore += Math.max(0, 6 - rank);
        row.rankTotal += rank;
        row.rankCount += 1;
        if (rank === 1) row.topOneCount += 1;
      });
    });

    (response.priceValue || []).forEach((item) => {
      const row = rowsById[item.id];
      if (!row) return;
      const acceptedPrice = Number(item.acceptedPrice || 0);
      const startPrice = Number(item.startPrice || row.asset.rrp || 0);
      if (!acceptedPrice || !startPrice) return;
      row.priceTotal += acceptedPrice;
      row.tooExpensiveTotal += Number(item.tooExpensivePrice || startPrice + 15);
      row.priceCount += 1;
      row.retentionTotal += Math.min(125, Math.round((acceptedPrice / startPrice) * 100));
    });

    (response.occasionFit || []).forEach((item) => {
      const row = rowsById[item.id];
      if (!row || !item.occasion) return;
      row.occasions[item.occasion] = (row.occasions[item.occasion] || 0) + 1;
    });

    (response.founderAction || []).forEach((item) => {
      const row = rowsById[item.id];
      if (!row || !item.action) return;
      row.actions[item.action] = (row.actions[item.action] || 0) + 1;
    });
  });

  const rows = Object.values(rowsById).map((row) => {
    const driverEntries = Object.entries(row.drivers).sort((a, b) => b[1] - a[1]);
    const occasionEntries = Object.entries(row.occasions).sort((a, b) => b[1] - a[1]);
    const actionEntries = Object.entries(row.actions).sort((a, b) => b[1] - a[1]);
    const segmentEntries = Object.entries(row.segments).sort((a, b) => b[1] - a[1]);
    row.topDriver = driverEntries[0]?.[0] || "";
    row.topOccasion = occasionEntries[0]?.[0] || "";
    row.topAction = actionEntries[0]?.[0] || "";
    row.topSegment = segmentEntries[0]?.[0] || "";
    row.firstShare = totalPreferenceVotes ? Math.round((row.firstVotes / totalPreferenceVotes) * 100) : 0;
    row.averageRank = row.rankCount ? (row.rankTotal / row.rankCount).toFixed(1) : "";
    row.averageAcceptedPrice = row.priceCount ? Math.round(row.priceTotal / row.priceCount) : 0;
    row.averageTooExpensivePrice = row.priceCount ? Math.round(row.tooExpensiveTotal / row.priceCount) : 0;
    row.priceRetention = row.priceCount ? Math.round(row.retentionTotal / row.priceCount) : 0;
    row.score = row.firstVotes * 12 + row.purchaseScore * 4 + row.topOneCount * 8 + Math.round(row.priceRetention / 4) + (row.topAction?.startsWith("Launch") ? 18 : 0);
    return row;
  }).filter((row) => row.firstVotes || row.rankCount || row.priceCount || row.topOccasion || row.topAction)
    .sort((a, b) => b.score - a.score || b.firstVotes - a.firstVotes || b.purchaseScore - a.purchaseScore);

  const leaders = {
    overall: rows[0],
    first: [...rows].sort((a, b) => b.firstVotes - a.firstVotes || b.score - a.score)[0],
    purchase: [...rows].sort((a, b) => b.purchaseScore - a.purchaseScore || b.topOneCount - a.topOneCount)[0],
    price: [...rows].filter((row) => row.priceCount).sort((a, b) => b.priceRetention - a.priceRetention || b.averageAcceptedPrice - a.averageAcceptedPrice)[0],
    occasion: [...rows].filter((row) => row.topOccasion).sort((a, b) => topCount(b.occasions) - topCount(a.occasions))[0],
    action: [...rows].filter((row) => row.topAction).sort((a, b) => actionStrength(b) - actionStrength(a))[0]
  };

  return {
    responses: responses.length,
    leaders,
    rows,
    conclusions: buildAnalyticsConclusions(leaders, rows)
  };
}

function topCount(counts) {
  return Object.values(counts).sort((a, b) => b - a)[0] || 0;
}

function actionStrength(row) {
  const launchCount = (row.actions["Launch as is"] || 0) + (row.actions["Launch in another colour"] || 0);
  return launchCount * 3 + topCount(row.actions) + row.score / 100;
}

function buildAnalyticsConclusions(leaders, rows) {
  if (!rows.length) return [];
  const conclusions = [];
  const overall = leaders.overall;
  conclusions.push(`${overall.name} is the strongest overall design, combining ${overall.firstVotes} first-impression vote${plural(overall.firstVotes)}, ${overall.topOneCount} #1 purchase ranking${plural(overall.topOneCount)}, and a ${overall.priceRetention || 0}% price-confidence score.`);

  if (leaders.first) {
    const reason = leaders.first.topDriver ? ` The main reason is "${leaders.first.topDriver}".` : "";
    conclusions.push(`${leaders.first.name} is the fastest visual winner with ${leaders.first.firstVotes} preference vote${plural(leaders.first.firstVotes)} and ${leaders.first.firstShare}% share of head-to-head wins.${reason}`);
  }

  if (leaders.purchase) {
    conclusions.push(`${leaders.purchase.name} looks most sellable in the ranking exercise, with ${leaders.purchase.topOneCount} #1 placement${plural(leaders.purchase.topOneCount)} and an average rank of ${leaders.purchase.averageRank || "-"}.`);
  }

  if (leaders.price) {
    conclusions.push(`${leaders.price.name} shows the strongest price resilience, with customers holding at an average accepted price of $${leaders.price.averageAcceptedPrice}, or ${leaders.price.priceRetention}% of the tested price.`);
  }

  if (leaders.occasion) {
    conclusions.push(`${leaders.occasion.name} has the clearest use case: customers most often imagine it for ${leaders.occasion.topOccasion}. This is useful for merchandising copy and campaign imagery.`);
  }

  if (leaders.action) {
    conclusions.push(`${leaders.action.name} has the clearest founder action signal: "${leaders.action.topAction}". This should guide whether the next move is launch, tweak, recolour, reprice, or drop.`);
  }

  if (overall.topSegment) {
    conclusions.push(`${overall.name} is currently strongest with the ${overall.topSegment} age segment. Treat this as directional until the employee or customer sample is larger.`);
  }

  const gap = rows.find((row) => row.firstVotes >= 2 && row.rankCount && Number(row.averageRank) > 3.2);
  if (gap) {
    conclusions.push(`${gap.name} may be more visually attractive than commercially decisive: it wins attention, but its average purchase rank is ${gap.averageRank}. This is a useful candidate for tweaking price, colour, or styling before launch.`);
  }

  return [...new Set(conclusions)].slice(0, 6);
}

function plural(count) {
  return Number(count) === 1 ? "" : "s";
}

function previewScreen() {
  return `
    <main class="phone-wrap">
      <section class="phone">
        <div class="preview-time-card">
          <span>Estimated survey time</span>
          <strong>2-5 mins</strong>
        </div>
        ${previewProgress()}
        ${customerStep === "profile" ? profilePreview() : ""}
        ${customerStep === "first" ? firstPreview() : ""}
        ${customerStep === "purchase" ? purchasePreview() : ""}
        ${customerStep === "occasion" ? occasionPreview() : ""}
        ${customerStep === "price" ? pricePreview() : ""}
        ${customerStep === "action" ? actionPreview() : ""}
        ${customerStep === "done" ? completePreview() : ""}
      </section>
    </main>
  `;
}

function previewProgress() {
  const steps = ["profile", "first", "purchase", "occasion", "price", "action", "done"];
  const current = Math.max(0, steps.indexOf(customerStep));
  return `<div class="session-progress"><span style="--progress:${Math.round(((current + 1) / steps.length) * 100)}%"></span></div>`;
}

function profilePreview() {
  const copy = surveyCopy();
  return `
    <div class="phone-head">
      <span>Step 1 of 6</span>
      <strong>Profile</strong>
    </div>
    <h2>${copy.profileHeading}</h2>
    <p class="hint">${copy.profileHint}</p>
    <div class="profile-form">
      ${profileQuestionSet().map((question) => profileQuestion(question)).join("")}
    </div>
    <button class="primary-button full-width" data-action="save-profile">${copy.profileStartButton}</button>
  `;
}

function profileQuestion(question) {
  const inputType = question.multiple ? "checkbox" : "radio";
  return `
    <fieldset class="choice-group" data-profile-group="${question.key}" data-profile-multiple="${question.multiple ? "true" : "false"}">
      <legend>${question.label}${question.multiple ? " (choose all that apply)" : ""}</legend>
      ${question.options.map((option, index) => `
        <label class="choice-pill">
          <input type="${inputType}" name="${question.key}" value="${escapeAttribute(option)}" ${index === 0 ? "checked" : ""} />
          <span>${option}</span>
        </label>
      `).join("")}
    </fieldset>
  `;
}

function firstPreview() {
  const matches = firstImpressionMatches();
  const match = matches[customerMatch];
  if (!match) {
    customerStep = "purchase";
    customerRound = 0;
    render();
    return "";
  }
  const left = assetById(match.left);
  const right = assetById(match.right);
  return `
    <div class="phone-head">
      <span>Step 2 of 6</span>
      <strong>${customerMatch + 1} / ${matches.length}</strong>
    </div>
    <h2>Which design would you be more excited to see Sunday Staples launch?</h2>
    <p class="hint">Tap your preferred design, then choose the reason that best explains your choice.</p>
    <div class="mobile-battle">
      ${mobileChoice(left, "left", match)}
      ${mobileChoice(right, "right", match)}
    </div>
  `;
}

function mobileChoice(asset, side, match) {
  return `
    <article class="mobile-choice" tabindex="0">
      <div class="choice-image">
        <img style="${imageStyle(asset)}" src="${asset.image}" alt="${escapeAttribute(asset.name)}" />
        <div class="hover-drivers" aria-label="Why did you prefer this design?">
          <small>Choose why</small>
          ${firstImpressionDrivers.map((driver) => `
            <button type="button" data-action="first-choice" data-id="${asset.id}" data-side="${side}" data-tag="${escapeAttribute(match.tag)}" data-driver="${driver}">
              ${driver}
            </button>
          `).join("")}
        </div>
      </div>
      <strong>${asset.name}</strong>
      <span>${asset.category}</span>
      <span>${asset.material}</span>
      <span>RRP $${asset.rrp}</span>
    </article>
  `;
}

function structuredReasonBlock(prefix) {
  return `
    <div class="reason-box">
      <label>Recommended action
        <select data-${prefix}-field="request">
          ${actionChoices.map((choice) => `<option>${choice}</option>`).join("")}
        </select>
      </label>
      <label>Value signal
        <select data-${prefix}-field="driver">
          ${priceDriverChoices.map((choice) => `<option>${choice}</option>`).join("")}
        </select>
      </label>
    </div>
  `;
}

function purchasePreview() {
  if (purchaseRound >= state.showroom.purchaseRounds.length) {
    customerStep = "occasion";
    customerRound = 0;
    render();
    return "";
  }
  const ids = uniqueIds(state.showroom.purchaseRounds[purchaseRound] || []);
  const ranked = currentPurchaseRanking(ids);
  if (!ids.length) {
    purchaseRound += 1;
    render();
    return "";
  }
  return `
    <div class="phone-head">
      <span>Step 3 of 6</span>
      <strong>${purchaseRound + 1} / ${state.showroom.purchaseRounds.length}</strong>
    </div>
    <h2>Rank which designs you would most likely buy within the next 30 days.</h2>
    <p class="hint">Place your strongest purchase choice at #1. Drag cards into place or use the Up / Down buttons.</p>
    <div class="current-pick">
      <span>Current #1</span>
      <strong>${assetById(ranked[0])?.name || "-"}</strong>
    </div>
    <div class="rank-plane" data-rank-plane>
      ${ranked.map((id, index) => rankThumb(assetById(id), index)).join("")}
    </div>
    <div class="sticky-save">
      <button class="primary-button" data-action="save-purchase-round">Save ranking</button>
    </div>
  `;
}

function rankThumb(asset, index) {
  if (!asset) return "";
  return `
    <div class="rank-thumb" draggable="true" data-rank-id="${asset.id}">
      <span class="rank-slot-number">#${index + 1}</span>
      <img style="${imageStyle(asset)}" src="${asset.image}" alt="${escapeAttribute(asset.name)}" />
      <div>
        <small>Drag to reorder</small>
        <strong>${asset.name}</strong>
      </div>
      <div class="rank-actions">
        <button type="button" data-action="rank-move" data-direction="-1" data-rank-id="${asset.id}" ${index === 0 ? "disabled" : ""}>Up</button>
        <button type="button" data-action="rank-move" data-direction="1" data-rank-id="${asset.id}" ${index === 4 ? "disabled" : ""}>Down</button>
      </div>
    </div>
  `;
}

function occasionPreview() {
  const id = state.showroom.occasionItems[customerRound];
  if (!id) {
    customerStep = "price";
    customerRound = 0;
    priceIndex = 0;
    render();
    return "";
  }
  const asset = assetById(id);
  return `
    <div class="phone-head">
      <span>Step 4 of 6</span>
      <strong>${customerRound + 1} / ${state.showroom.occasionItems.length}</strong>
    </div>
    <h2>Where would you most likely wear this design?</h2>
    <p class="hint">Choose the occasion that feels most natural. This helps us understand how to position the product.</p>
    ${singleDesignPrompt(asset)}
    <div class="option-grid">
      ${occasionChoices.map((choice) => `<button type="button" data-action="save-occasion" data-value="${escapeAttribute(choice)}">${choice}</button>`).join("")}
    </div>
  `;
}

function pricePreview() {
  const item = state.showroom.priceItems[priceIndex];
  if (!item) {
    customerStep = "action";
    customerRound = 0;
    render();
    return "";
  }
  const asset = assetById(item.id);
  const min = Math.max(1, Number(item.startPrice) - 15);
  const tooHigh = Number(item.startPrice) + 30;
  return `
    <div class="phone-head">
      <span>Step 5 of 6</span>
      <strong>${priceIndex + 1} / ${state.showroom.priceItems.length}</strong>
    </div>
    <h2>At what price would this still feel like good value?</h2>
    <p class="hint">Start from the shown price. Slide down only if the design would need to cost less for you to feel comfortable buying it.</p>
    <article class="price-preview-card">
      <img style="${imageStyle(asset)}" src="${asset.image}" alt="${escapeAttribute(asset.name)}" />
      <strong>${asset.name}</strong>
      <span>${asset.category} · ${asset.material}</span>
    </article>
    <div class="price-slider">
      <strong>$<span data-price-readout>${item.startPrice}</span></strong>
      <input type="range" min="${min}" max="${item.startPrice}" value="${item.startPrice}" step="1" data-action="price-slider" />
      <div><span>$${min}</span><span>$${item.startPrice}</span></div>
    </div>
    <div class="price-slider secondary-price">
      <label>At what price would it start to feel too expensive?</label>
      <strong>$<span data-too-expensive-readout>${Number(item.startPrice) + 15}</span></strong>
      <input type="range" min="${item.startPrice}" max="${tooHigh}" value="${Number(item.startPrice) + 15}" step="1" data-action="too-expensive-slider" />
      <div><span>$${item.startPrice}</span><span>$${tooHigh}</span></div>
    </div>
    ${structuredReasonBlock("price")}
    <button class="primary-button" data-action="save-price">Next design</button>
  `;
}

function actionPreview() {
  const id = state.showroom.actionItems[customerRound];
  if (!id) {
    customerStep = "done";
    draftResponse.completedAt = new Date().toISOString();
    state.responses.push(draftResponse);
    saveState();
    render();
    return "";
  }
  const asset = assetById(id);
  return `
    <div class="phone-head">
      <span>Step 6 of 6</span>
      <strong>${customerRound + 1} / ${state.showroom.actionItems.length}</strong>
    </div>
    <h2>What should Sunday Staples do with this design?</h2>
    <p class="hint">Choose the action you would recommend if you were helping us decide the launch plan.</p>
    <article class="price-preview-card">
      <img style="${imageStyle(asset)}" src="${asset.image}" alt="${escapeAttribute(asset.name)}" />
      <strong>${asset.name}</strong>
      <span>${asset.category} - ${asset.material} - RRP $${asset.rrp}</span>
    </article>
    <div class="option-grid">
      ${actionChoices.map((choice) => `<button type="button" data-action="save-founder-action" data-value="${escapeAttribute(choice)}">${choice}</button>`).join("")}
    </div>
  `;
}

function singleDesignPrompt(asset) {
  return `
    <article class="price-preview-card">
      <img style="${imageStyle(asset)}" src="${asset.image}" alt="${escapeAttribute(asset.name)}" />
      <strong>${asset.name}</strong>
      <span>${asset.category} - ${asset.material} - RRP $${asset.rrp}</span>
    </article>
  `;
}

function completePreview() {
  return `
    <div class="complete">
      <p class="eyebrow">Preview complete</p>
      <h2>Thank you. Your influence has been recorded.</h2>
      <p class="hint">Your feedback helps shape what Sunday Staples launches next. In the live version, this is where Sunday Points or other rewards would be confirmed.</p>
      <button class="primary-button" data-action="restart-preview">Start preview again</button>
    </div>
  `;
}

function assetsWithTag(tag) {
  return state.assets.filter((asset) => tagsFor(asset).map((item) => item.toLowerCase()).includes(String(tag).toLowerCase()));
}

function firstImpressionMatches() {
  const matches = [];
  state.showroom.firstRounds = normaliseFirstRounds(state.showroom.firstRounds, state.showroom.firstTags, state.assets);
  state.showroom.firstRounds.forEach((round, roundIndex) => {
    const tag = `Round ${roundIndex + 1}`;
    const assets = uniqueIds(round).map(assetById).filter(Boolean);
    if (assets.length < 2) return;
    for (let i = 0; i < 4; i += 1) {
      const left = assets[i % assets.length];
      const right = assets[(i + 1) % assets.length];
      if (left.id !== right.id) matches.push({ tag, left: left.id, right: right.id });
    }
  });
  return matches.slice(0, 12);
}

function favouriteResults() {
  const firstScores = {};
  const purchaseScores = {};
  const priceScores = {};
  state.responses.forEach((response) => {
    response.firstImpressions.forEach((item) => {
      firstScores[item.winner] = (firstScores[item.winner] || 0) + 1;
    });
    response.purchaseIntent.forEach((round) => {
      (round.ranking || []).forEach((id, index) => {
        purchaseScores[id] = (purchaseScores[id] || 0) + (5 - index);
      });
    });
    response.priceValue.forEach((item) => {
      priceScores[item.id] = (priceScores[item.id] || 0) + Number(item.acceptedPrice || 0);
    });
  });
  return {
    first: assetById(topId(firstScores))?.name,
    purchase: assetById(topId(purchaseScores))?.name,
    price: assetById(topId(priceScores))?.name
  };
}

function topId(scores) {
  return Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0];
}

function bindEvents() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      view = button.dataset.view;
      render();
    });
  });

  document.querySelectorAll("[data-backend-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      backendTab = button.dataset.backendTab;
      render();
    });
  });

  document.querySelector("[data-action='upload-assets']")?.addEventListener("change", async (event) => {
    await addUploadedFiles([...event.target.files]);
  });

  const dropZone = document.querySelector("[data-drop-zone]");
  if (dropZone) {
    dropZone.addEventListener("dragover", (event) => {
      event.preventDefault();
      dropZone.classList.add("drag-over");
    });
    dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
    dropZone.addEventListener("drop", async (event) => {
      event.preventDefault();
      dropZone.classList.remove("drag-over");
      const files = [...event.dataTransfer.files].filter((file) => file.type.startsWith("image/"));
      await addUploadedFiles(files);
    });
  }

  document.querySelectorAll("[data-asset]").forEach((card) => {
    card.querySelectorAll("[data-field]").forEach((field) => {
      field.addEventListener("input", () => updateAssetFromCard(card));
      field.addEventListener("change", () => updateAssetFromCard(card));
    });
    bindCropDrag(card);
  });

  document.querySelectorAll("[data-first-round]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const roundIndex = Number(checkbox.dataset.firstRound);
      const round = state.showroom.firstRounds[roundIndex] || [];
      if (checkbox.checked && !round.includes(checkbox.value)) round.push(checkbox.value);
      if (!checkbox.checked) state.showroom.firstRounds[roundIndex] = round.filter((id) => id !== checkbox.value);
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-purchase-round]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const round = state.showroom.purchaseRounds[Number(checkbox.dataset.purchaseRound)];
      if (checkbox.checked && round.length < 5) round.push(checkbox.value);
      if (!checkbox.checked) state.showroom.purchaseRounds[Number(checkbox.dataset.purchaseRound)] = round.filter((id) => id !== checkbox.value);
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-price-enabled]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const id = checkbox.dataset.priceEnabled;
      if (checkbox.checked) state.showroom.priceItems.push({ id, startPrice: Number(document.querySelector(`[data-price-start='${id}']`).value) });
      else state.showroom.priceItems = state.showroom.priceItems.filter((item) => item.id !== id);
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-occasion-enabled]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const id = checkbox.dataset.occasionEnabled;
      if (checkbox.checked && !state.showroom.occasionItems.includes(id)) state.showroom.occasionItems.push(id);
      if (!checkbox.checked) state.showroom.occasionItems = state.showroom.occasionItems.filter((itemId) => itemId !== id);
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-action-enabled]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const id = checkbox.dataset.actionEnabled;
      if (checkbox.checked && !state.showroom.actionItems.includes(id)) state.showroom.actionItems.push(id);
      if (!checkbox.checked) state.showroom.actionItems = state.showroom.actionItems.filter((itemId) => itemId !== id);
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-price-start]").forEach((input) => {
    input.addEventListener("change", () => {
      const item = state.showroom.priceItems.find((priceItem) => priceItem.id === input.dataset.priceStart);
      if (item) {
        item.startPrice = Number(input.value);
        const asset = assetById(item.id);
        if (asset) asset.rrp = Number(input.value) || asset.rrp;
      }
      saveState();
    });
  });

  document.querySelector("[data-action='save-backend']")?.addEventListener("click", () => {
    updateProfileQuestionsFromForm();
    saveState();
    saveNotice = backendTab === "profile" ? "Profile questions saved. Preview has been updated." : "Survey setup saved.";
    render();
  });

  document.querySelector("[data-action='reset-profile-questions']")?.addEventListener("click", () => {
    state.showroom.profileQuestions = cloneProfileQuestions(defaultProfileQuestions);
    saveState();
    saveNotice = "Participant Profile reset to the recommended template.";
    render();
  });

  document.querySelector("[data-action='save-repository']")?.addEventListener("click", () => {
    document.querySelectorAll("[data-asset]").forEach((card) => updateAssetFromCard(card, false));
    syncPriceItemsWithAssets();
    saveState();
    saveNotice = `Saved ${state.assets.length} repository concept${state.assets.length === 1 ? "" : "s"}. Preview has been updated.`;
    render();
  });

  document.querySelector("[data-action='clear-responses']")?.addEventListener("click", () => {
    state.responses = [];
    saveState();
    render();
  });

  document.querySelector("[data-action='save-profile']")?.addEventListener("click", () => {
    document.querySelectorAll("[data-profile-group]").forEach((group) => {
      const selected = [...group.querySelectorAll("input:checked")].map((input) => input.value);
      draftResponse.profile[group.dataset.profileGroup] = group.dataset.profileMultiple === "true" ? selected : selected[0] || "";
    });
    customerStep = "first";
    render();
  });

  document.querySelectorAll("[data-action='first-choice']").forEach((button) => {
    button.addEventListener("click", () => {
      draftResponse.firstImpressions.push({
        tag: button.dataset.tag,
        winner: button.dataset.id,
        request: "",
        driver: button.dataset.driver || ""
      });
      customerMatch += 1;
      render();
    });
  });

  bindRankingDrag();

  document.querySelector("[data-action='save-purchase-round']")?.addEventListener("click", () => {
    const expected = uniqueIds(state.showroom.purchaseRounds[purchaseRound] || []);
    const ranking = uniqueRanking(readRankingOrder(), expected);
    if (!expected.length || ranking.length !== expected.length || new Set(ranking).size !== ranking.length) {
      draftResponse.purchaseIntent[purchaseRound] = { ...(draftResponse.purchaseIntent[purchaseRound] || {}), ranking };
      render();
      return;
    }
    draftResponse.purchaseIntent[purchaseRound] = {
      ranking,
      request: "",
      driver: ""
    };
    purchaseRound += 1;
    render();
  });

  document.querySelectorAll("[data-action='save-occasion']").forEach((button) => {
    button.addEventListener("click", () => {
      draftResponse.occasionFit.push({
        id: state.showroom.occasionItems[customerRound],
        occasion: button.dataset.value
      });
      customerRound += 1;
      render();
    });
  });

  document.querySelectorAll("[data-action='rank-move']").forEach((button) => {
    button.addEventListener("click", () => {
      movePurchaseRank(button.dataset.rankId, Number(button.dataset.direction));
    });
  });

  document.querySelector("[data-action='price-slider']")?.addEventListener("input", (event) => {
    document.querySelector("[data-price-readout]").textContent = event.target.value;
  });

  document.querySelector("[data-action='too-expensive-slider']")?.addEventListener("input", (event) => {
    document.querySelector("[data-too-expensive-readout]").textContent = event.target.value;
  });

  document.querySelector("[data-action='save-price']")?.addEventListener("click", () => {
    const item = state.showroom.priceItems[priceIndex];
    draftResponse.priceValue.push({
      id: item.id,
      startPrice: item.startPrice,
      acceptedPrice: Number(document.querySelector("[data-action='price-slider']").value),
      tooExpensivePrice: Number(document.querySelector("[data-action='too-expensive-slider']").value),
      request: document.querySelector("[data-price-field='request']").value,
      driver: document.querySelector("[data-price-field='driver']").value
    });
    priceIndex += 1;
    render();
  });

  document.querySelectorAll("[data-action='save-founder-action']").forEach((button) => {
    button.addEventListener("click", () => {
      draftResponse.founderAction.push({
        id: state.showroom.actionItems[customerRound],
        action: button.dataset.value
      });
      customerRound += 1;
      render();
    });
  });

  document.querySelector("[data-action='restart-preview']")?.addEventListener("click", () => {
    customerStep = "profile";
    customerMatch = 0;
    customerRound = 0;
    purchaseRound = 0;
    priceIndex = 0;
    draftResponse = freshResponse();
    render();
  });
}

function updateAssetFromCard(card, shouldSave = true) {
  const asset = assetById(card.dataset.asset);
  if (!asset) return;
  asset.crop = normaliseCrop(asset);
  const value = (field) => card.querySelector(`[data-field='${field}']`)?.value || "";
  asset.name = value("name").trim() || "Untitled concept";
  asset.category = value("category").trim() || "Shoe concept";
  asset.material = value("material").trim() || "To be confirmed";
  asset.rrp = Number(value("rrp")) || 159;
  asset.crop.zoom = Number(value("zoom")) || 100;
  asset.tags = value("tags").split(",").map((tag) => tag.trim()).filter(Boolean);
  if (shouldSave) saveState();
  card.querySelector("[data-drag-crop]").setAttribute("style", thumbnailStyle(asset));
}

function updateProfileQuestionsFromForm() {
  const current = profileQuestionSet();
  state.showroom.copy = {
    ...surveyCopy(),
    profileHeading: document.querySelector("[data-copy-field='profileHeading']")?.value.trim() || defaultSurveyCopy.profileHeading,
    profileHint: document.querySelector("[data-copy-field='profileHint']")?.value.trim() || defaultSurveyCopy.profileHint,
    profileStartButton: document.querySelector("[data-copy-field='profileStartButton']")?.value.trim() || defaultSurveyCopy.profileStartButton
  };
  state.showroom.profileQuestions = normaliseProfileQuestions(current.map((question, index) => {
    const label = document.querySelector(`[data-profile-label='${index}']`)?.value.trim() || question.label;
    const rawOptions = document.querySelector(`[data-profile-options='${index}']`)?.value || "";
    const options = rawOptions
      .split(/\r?\n|,/)
      .map((option) => option.trim())
      .filter(Boolean)
      .slice(0, 8);
    return {
      ...question,
      label,
      options: options.length ? options : question.options
    };
  }));
}

async function addUploadedFiles(files) {
  for (const file of files) {
    const image = await readFile(file);
    state.assets.unshift({
      id: `asset-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: file.name.replace(/\.[^.]+$/, ""),
      category: "Shoe concept",
      material: "To be confirmed",
      rrp: 159,
      tags: ["Tag 1"],
      image,
      crop: { x: 50, y: 50, zoom: 100, left: 8, top: 8, width: 84, height: 84, aspect: "1:1" }
    });
  }
  saveState();
  render();
}

function bindCropDrag(card) {
  const crop = card.querySelector("[data-drag-crop]");
  const asset = assetById(card.dataset.asset);
  asset.crop = normaliseCrop(asset);
  let active = false;
  let startX = 0;
  let startY = 0;
  let mode = "move";
  let startBox = null;
  crop.addEventListener("pointerdown", (event) => {
    const handle = event.target.closest("[data-crop-handle]");
    if (!handle) return;
    active = true;
    startX = event.clientX;
    startY = event.clientY;
    mode = handle.dataset.cropHandle;
    startBox = { ...asset.crop };
    crop.setPointerCapture(event.pointerId);
    crop.classList.add("is-cropping");
  });
  crop.addEventListener("pointermove", (event) => {
    if (!active) return;
    const rect = crop.getBoundingClientRect();
    const dx = ((event.clientX - startX) / rect.width) * 100;
    const dy = ((event.clientY - startY) / rect.height) * 100;
    asset.crop = { ...asset.crop, ...resizeCropBox(startBox, mode, dx, dy) };
    crop.setAttribute("style", thumbnailStyle(asset));
  });
  crop.addEventListener("pointerup", () => {
    active = false;
    crop.classList.remove("is-cropping");
    saveState();
  });

  card.querySelectorAll("[data-crop-aspect]").forEach((button) => {
    button.addEventListener("click", () => {
      asset.crop = { ...normaliseCrop(asset), ...boxForAspect(button.dataset.cropAspect), aspect: button.dataset.cropAspect };
      saveState();
      render();
    });
  });
}

function resizeCropBox(start, mode, dx, dy) {
  const min = 18;
  let left = start.left;
  let top = start.top;
  let width = start.width;
  let height = start.height;
  if (mode === "move") {
    left = clamp(start.left + dx, 0, 100 - width);
    top = clamp(start.top + dy, 0, 100 - height);
  }
  if (mode.includes("w")) {
    left = clamp(start.left + dx, 0, start.left + start.width - min);
    width = start.width + (start.left - left);
  }
  if (mode.includes("e")) width = clamp(start.width + dx, min, 100 - left);
  if (mode.includes("n")) {
    top = clamp(start.top + dy, 0, start.top + start.height - min);
    height = start.height + (start.top - top);
  }
  if (mode.includes("s")) height = clamp(start.height + dy, min, 100 - top);
  return { left: round(left), top: round(top), width: round(width), height: round(height) };
}

function boxForAspect(aspect) {
  const presets = {
    "1:1": { width: 84, height: 84 },
    "4:6": { width: 56, height: 84 },
    "6:4": { width: 84, height: 56 },
    "4:5": { width: 67.2, height: 84 }
  };
  const size = presets[aspect] || presets["1:1"];
  return {
    left: round((100 - size.width) / 2),
    top: round((100 - size.height) / 2),
    width: size.width,
    height: size.height
  };
}

function round(value) {
  return Math.round(value * 10) / 10;
}

function bindRankingDrag() {
  let draggedId = null;
  document.querySelectorAll(".rank-thumb[data-rank-id]").forEach((item) => {
    item.addEventListener("dragstart", () => {
      draggedId = item.dataset.rankId;
      item.classList.add("dragging");
    });
    item.addEventListener("dragend", () => {
      item.classList.remove("dragging");
      document.querySelectorAll(".drop-target").forEach((node) => node.classList.remove("drop-target"));
    });
    item.addEventListener("dragenter", () => {
      if (draggedId && draggedId !== item.dataset.rankId) item.classList.add("drop-target");
    });
    item.addEventListener("dragleave", () => item.classList.remove("drop-target"));
    item.addEventListener("dragover", (event) => {
      event.preventDefault();
      if (draggedId && draggedId !== item.dataset.rankId) item.classList.add("drop-target");
    });
    item.addEventListener("drop", (event) => {
      event.preventDefault();
      if (!draggedId || draggedId === item.dataset.rankId) return;
      applyPurchaseReorder(draggedId, item.dataset.rankId);
      render();
    });
  });
}

function currentPurchaseRanking(fallbackIds = []) {
  const saved = draftResponse.purchaseIntent[purchaseRound]?.ranking || [];
  const clean = uniqueRanking(saved, uniqueIds(fallbackIds));
  draftResponse.purchaseIntent[purchaseRound] = { ...(draftResponse.purchaseIntent[purchaseRound] || {}), ranking: clean };
  return clean;
}

function readRankingOrder() {
  return uniqueRanking([...document.querySelectorAll(".rank-thumb[data-rank-id]")].map((item) => item.dataset.rankId), uniqueIds(state.showroom.purchaseRounds[purchaseRound] || []));
}

function applyPurchaseReorder(draggedId, targetId) {
  const current = readRankingOrder();
  const from = current.indexOf(draggedId);
  const to = current.indexOf(targetId);
  if (from < 0 || to < 0 || from === to) return;
  const [moved] = current.splice(from, 1);
  current.splice(to, 0, moved);
  draftResponse.purchaseIntent[purchaseRound] = { ...(draftResponse.purchaseIntent[purchaseRound] || {}), ranking: uniqueRanking(current, uniqueIds(state.showroom.purchaseRounds[purchaseRound] || [])) };
}

function movePurchaseRank(id, direction) {
  const current = readRankingOrder();
  const from = current.indexOf(id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= current.length) return;
  const [moved] = current.splice(from, 1);
  current.splice(to, 0, moved);
  draftResponse.purchaseIntent[purchaseRound] = { ...(draftResponse.purchaseIntent[purchaseRound] || {}), ranking: uniqueRanking(current, uniqueIds(state.showroom.purchaseRounds[purchaseRound] || [])) };
  render();
}

function uniqueRanking(ranking = [], fallbackIds = []) {
  const fallback = uniqueIds(fallbackIds);
  const allowed = new Set(fallback);
  const seen = new Set();
  const clean = [];
  ranking.forEach((id) => {
    if (!allowed.has(id) || seen.has(id)) return;
    seen.add(id);
    clean.push(id);
  });
  fallback.forEach((id) => {
    if (!seen.has(id)) {
      seen.add(id);
      clean.push(id);
    }
  });
  return clean.slice(0, fallback.length);
}

function uniqueIds(ids = []) {
  return [...new Set(ids.filter(Boolean))];
}

function readFile(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

function escapeAttribute(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

render();
