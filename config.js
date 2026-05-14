const rawConcepts = Array.from({ length: 15 }, (_, index) => {
  const number = String(index + 1).padStart(2, "0");
  const ext = index + 1 >= 12 ? "jpg" : "png";
  const names = {
    12: "Cream Mesh Floral Flats",
    13: "Light Blue Mesh Floral Flats",
    14: "Nude Mesh Floral Flats",
    15: "Pink Mesh Floral Flats"
  };

  return {
    id: `concept-${number}`,
    brandId: "sunday-staples",
    factoryCode: `SS-FY26-${number}`,
    name: names[index + 1] || `Factory Concept ${number}`,
    category: index + 1 >= 12 ? "Mesh Floral Flats" : "Factory Shortlist",
    targetSeason: "FY26 Preview",
    priceBand: "$139-$169",
    material: index + 1 >= 12 ? "Mesh upper" : "To be confirmed",
    colorway: ["Cream", "Black", "Blush", "Nude", "Sage", "Light Blue"][index % 6],
    media: [
      {
        type: "image",
        url: `https://raw.githubusercontent.com/chamaurise/sundaystaples-innercircle/main/shoe-concepts/concept-${number}.${ext}`,
        alt: `Sunday Staples shoe concept ${number}`
      }
    ],
    notes: "Upcoming concept for customer-led factory ordering decisions."
  };
});

window.INNER_CIRCLE_CONFIG = {
  brands: [
    {
      id: "sunday-staples",
      name: "Sunday Staples",
      mission: "Comfort-led shoes that feel polished, versatile, and easy to live in.",
      palette: {
        ink: "#171412",
        paper: "#fbf7f1",
        blush: "#e7b8ac",
        sage: "#6f8d7a",
        merlot: "#773d35",
        gold: "#a77b3f"
      },
      rewardCurrency: "Sunday Points"
    }
  ],
  members: [
    {
      email: "maurice@sundaystaples.com",
      name: "Maurice",
      tier: "Founder Preview",
      segment: "Team",
      points: 12800
    },
    {
      email: "vip@sundaystaples.com",
      name: "VIP Customer",
      tier: "Top Sunday Points Member",
      segment: "VIP",
      points: 3400
    },
    {
      email: "friend@sundaystaples.com",
      name: "Sunday Friend",
      tier: "Friends & Family Circle",
      segment: "Friends & Family",
      points: 900
    }
  ],
  concepts: rawConcepts,
  campaigns: [
    {
      id: "fy26-factory-shortlist",
      brandId: "sunday-staples",
      schemaVersion: "survey-v1",
      title: "FY26 Factory Shortlist",
      status: "live",
      audience: "VIP customers in Singapore",
      reward: "150 Sunday Points",
      conceptIds: rawConcepts.slice(0, 8).map((concept) => concept.id),
      surveyDefinition: {
        engine: "qualtrics-inspired",
        embeddedData: [
          { key: "brandId", value: "sunday-staples" },
          { key: "campaignId", value: "fy26-factory-shortlist" },
          { key: "market", value: "Singapore" },
          { key: "launchSeason", value: "FY26 Preview" }
        ],
        blocks: [
          {
            id: "welcome-block",
            title: "Welcome",
            questionIds: ["intro"]
          },
          {
            id: "comparison-block",
            title: "Pairwise platform comparisons",
            questionIds: ["battle-1"],
            randomisation: {
              mode: "none",
              lockPairs: true,
              balanceLeftRight: true
            }
          },
          {
            id: "intent-block",
            title: "Commercial intent",
            questionIds: ["buying-intent", "ranking", "colour", "final"]
          }
        ],
        flow: [
          { type: "block", ref: "welcome-block" },
          { type: "block", ref: "comparison-block" },
          {
            type: "branch",
            label: "Continue only after at least one preference is captured",
            condition: { questionId: "battle-1", operator: "answered" },
            then: [{ type: "block", ref: "intent-block" }]
          }
        ],
        quotas: [
          { id: "vip-quota", segment: "VIP", targetResponses: 30 },
          { id: "friends-family-quota", segment: "Friends & Family", targetResponses: 20 }
        ],
        scoring: {
          pairwiseWeight: 45,
          buyingIntentWeight: 40,
          rankingWeight: 15,
          thresholds: {
            buy: 62,
            tweak: 42
          }
        },
        exportFields: [
          "campaignId",
          "member.segment",
          "answers.battle-1",
          "answers.buying-intent",
          "answers.ranking",
          "answers.colour",
          "answers.final",
          "submittedAt"
        ]
      },
      questions: [
        {
          id: "intro",
          type: "intro",
          required: true,
          analyticsKey: "intro_viewed",
          eyebrow: "Private design council",
          title: "Help shape the next Sunday Staples launch",
          body: "Review the same factory concepts Cherri would normally shortlist in person, then tell us what deserves to be bought, tweaked, or rejected."
        },
        {
          id: "battle-1",
          type: "pairwise",
          required: true,
          analyticsKey: "pairwise_buying_preference",
          prompt: "Which pair would you be more likely to buy?",
          pairs: [
            ["concept-01", "concept-02"],
            ["concept-03", "concept-04"],
            ["concept-05", "concept-06"],
            ["concept-07", "concept-08"]
          ],
          displayLogic: { source: "campaign.conceptIds", operator: "count_gte", value: 2 },
          collectReason: true,
          collectDrivers: true
        },
        {
          id: "buying-intent",
          type: "rating",
          required: true,
          analyticsKey: "buying_intent",
          prompt: "How strong is your buying intent for each design?",
          scale: ["Pass", "Curious", "Would try", "Likely buy", "Need this"]
        },
        {
          id: "ranking",
          type: "ranking",
          required: true,
          analyticsKey: "forced_rank",
          prompt: "Rank the finalists from strongest to weakest for Sunday Staples."
        },
        {
          id: "colour",
          type: "choice",
          required: true,
          analyticsKey: "colour_direction",
          prompt: "Which colour direction feels most Sunday Staples?",
          options: ["Cream", "Nude", "Black", "Blush", "Sage", "Light Blue"]
        },
        {
          id: "final",
          type: "text",
          required: false,
          analyticsKey: "open_tweak_feedback",
          validation: { maxLength: 600 },
          prompt: "What would you tweak before Sunday Staples places the order?"
        }
      ]
    }
  ]
};
