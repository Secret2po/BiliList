/* ==========================================================================
   BiliLIST — seed / sample data
   All names, emails, prices and events below are dummy data used for
   prototyping only (per the SPMP: "dummy/sample data only").

   The product catalogue is built on open, free Philippine sources:
     - Philippine Statistics Authority (PSA) Consumer Price Survey commodity
       structure and Metro Manila Price Bulletin retail units.
     - Wikipedia (CC BY-SA) categories of Philippine cuisine for the
       authentic local product names and their Filipino aliases.
   ========================================================================== */
(function (global) {
  'use strict';

  var NOW = new Date();
  var TODAY = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate());

  function iso(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function dayOffset(n) {
    var d = new Date(TODAY);
    d.setDate(d.getDate() + n);
    return d;
  }

  /* ====================================================== UNITS ========== */
  /* Retail units a Philippine household actually shops in. Grouped so the
     picker reads like a market stall sign, not a spreadsheet. */
  var UNITS = [
    { group: 'Count', units: [
      { k: 'pcs', l: 'pcs' },
      { k: 'dozen', l: 'dozen' },
      { k: 'bunch', l: 'bunch' }
    ] },
    { group: 'Weight', units: [
      { k: 'kg', l: 'kg' },
      { k: 'g', l: 'g' }
    ] },
    { group: 'Volume', units: [
      { k: 'L', l: 'L' },
      { k: 'ml', l: 'ml' }
    ] },
    { group: 'Pack', units: [
      { k: 'pack', l: 'pack' },
      { k: 'can', l: 'can' },
      { k: 'bottle', l: 'bottle' },
      { k: 'box', l: 'box' },
      { k: 'bag', l: 'bag' },
      { k: 'pouch', l: 'pouch' },
      { k: 'loaf', l: 'loaf' },
      { k: 'carton', l: 'carton' }
    ] }
  ];

  /* ================================================== MEMBERS ========== */
  var MEMBERS = [
    { id: 'm1', name: 'Alex Lopez',   email: 'alex.lopez@email.com',     initials: 'AL', role: 'Owner',  online: true,  you: true },
    { id: 'm2', name: 'Shane Lopez',  email: 'shane.lopez@email.com',    initials: 'SL', role: 'Editor', online: true },
    { id: 'm3', name: 'Qi Lopez',     email: 'qi.lopez@email.com',       initials: 'QL', role: 'Editor', online: true },
    { id: 'm4', name: 'Rainier Lopez',email: 'rainier.lopez@email.com',  initials: 'RL', role: 'Viewer', online: false }
  ];

  var WORKSPACES = [
    { id: 'w1', name: 'The Lopez Household', sub: '4 members · You\'re the owner', icon: 'house', active: true },
    { id: 'w2', name: 'Weekend crew',        sub: 'Friend group',                icon: 'friends', active: false }
  ];

  /* ==================================================== CATEGORIES ======= */
  /* These are only a starting point — the user can rename them, add keywords
     or create their own in the "Customize categories" panel. */
  var CATEGORIES = [
    { id: 'produce',   name: 'Produce',            tone: 'green',  custom: false, keywords: ['avocado', 'banana', 'tomato', 'apple', 'lettuce', 'onion', 'garlic', 'carrot', 'spinach', 'mango', 'lemon', 'cucumber', 'pepper', 'potato', 'orange', 'grape', 'berries', 'cabbage', 'broccoli', 'corn', 'pineapple', 'pear', 'peach', 'cilantro', 'scallion', 'suman', 'saba', 'kangkong', 'sitao', 'ampalaya', 'pechay', 'labanos', 'kalabasa', 'ube', 'gabi', 'singkamas', 'sayote', 'pumpkin', 'luya', 'santoros', 'mung bean sprout', 'taghoy', 'kamote', 'bamboo shoot', 'banana blossom', 'kalamansi', 'sampaloc', 'pomelo', 'mangga', 'lanzones', 'rambutan'] },
    { id: 'grains',    name: 'Rice & grains',      tone: 'navy',   custom: false, keywords: ['rice', 'bigas', 'sinangag', 'darigold', 'milled rice', 'corn', 'mais', 'oats', 'porridge', 'barley', 'quinoa', 'millet', 'sago', 'polenta', 'noodles', 'pancit', 'boodle', 'misua', ' spaghetti', 'macaroni', 'flour', 'arina', 'pan de stale'] },
    { id: 'meat',      name: 'Meat & poultry',     tone: 'red',    custom: false, keywords: ['chicken', 'beef', 'pork', 'lamb', 'bacon', 'sausage', 'hotdog', 'longganisa', 'tocino', 'chorizo', 'ham', 'litaw', 'bologna', 'ground beef', 'brisket', 'ribs', 'chicken breast', 'chicken leg', 'leg quarters', 'poultry'] },
    { id: 'seafood',   name: 'Fish & seafood',     tone: 'blue',   custom: false, keywords: ['fish', 'bangus', 'tilapia', 'milkfish', 'galunggong', 'tuna', 'sardine', 'la tuna', 'aluminhas', 'squid', 'pusit', 'shrimp', 'hipon', 'prawn', 'crab', 'aligue', 'clam', 'oyster', 'tahong', 'cockle', 'salted fish', 'tuyo', 'daing', 'tinapa', 'bangus belly', 'fish sauce', 'patis', 'shrimp paste', 'bagoong'] },
    { id: 'dairy',     name: 'Dairy & eggs',       tone: 'gold',   custom: false, keywords: ['milk', 'cheese', 'egg', 'butter', 'yogurt', 'cream', 'kefir', 'margarine', 'cheddar', 'mozzarella', 'parmesan', 'condensada', 'evaporated milk', 'powdered milk', 'canned milk'] },
    { id: 'bakery',    name: 'Bakery',             tone: 'wheat',  custom: false, keywords: ['bread', 'bun', 'bagel', 'croissant', 'pastry', 'tortilla', 'pita', 'cake', 'pie', 'muffin', 'pandesal', 'kaiser', 'sourdough', 'loaf', 'baguette', 'spanish bread', 'cocktail', 'pandesal'] },
    { id: 'canned',    name: 'Canned & dried',     tone: 'pink',   custom: false, keywords: ['canned', 'sardines', 'tuna', 'corned beef', 'hotdog', 'sardine', 'dried fish', 'dried shrimp', 'nori', 'cocoa', 'coconut milk', 'evaporated milk', 'pineapple', 'mango', 'raisins', 'dates', 'honey', 'jam', 'peanut'] },
    { id: 'condiments',name: 'Sauces & condiments',tone: 'grey',   custom: false, keywords: ['soy sauce', 'toyo', 'sauce', 'vinegar', 'sukang', 'bagoong', 'patis', 'datu puti', 'mang tomas', 'tomato ketchup', 'banana ketchup', 'mayonnaise', 'salamat', 'dayok', 'atchara', 'peanut sauce', 'chili sauce', 'sambal', 'toyomansi', 'garlic', 'vinegar', 'spiced vinegar', 'fish sauce', 'kalamansi'] },
    { id: 'snacks',    name: 'Snacks & sweets',    tone: 'violet', custom: false, keywords: ['chips', 'biscuit', 'candy', 'chocolate', 'cracker', 'nuts', 'popcorn', 'chicharon', 'prawn cracker', 'kwek kwek', 'fish ball', 'lumpia', 'pringle', 'coke', 'soft drink', 'candy', 'gummy', 'chocolate bar', 'potato chips', 'cookies', 'biscuits', 'pili nut', 'cashew', 'peanut'] },
    { id: 'beverages', name: 'Beverages',          tone: 'teal',   custom: false, keywords: ['juice', 'soda', 'water', 'coffee', 'tea', 'cider', 'beer', 'wine', 'soft drink', 'milo', 'chocolate drink', 'kapeng barako', 'salabat', 'bottled water', 'gatorade', 'coke', 'sprite', 'royal', 'fruit juice', 'juice tetra'] },
    { id: 'frozen',    name: 'Frozen',             tone: 'lime',   custom: false, keywords: ['frozen', 'ice cream', 'frozen food', 'ice', 'chilled', 'frozen chicken', 'frozen fish', 'ice pack'] },
    { id: 'cleaning',  name: 'Cleaning',           tone: 'blue',   custom: false, keywords: ['dishwashing', 'dish soap', 'dishwash', 'detergent', 'laundry', 'soap', 'sponge', 'bleach', 'mop', 'cleaner', 'foil', 'trash', 'tissue', 'disinfectant', 'dishwasher tablet', 'fabric softener', 'scouring powder', 'glass cleaner', 'floor cleaner', 'garbage bag', 'paper towel', 'toilet paper'] },
    { id: 'household', name: 'Household & care',   tone: 'brown',  custom: false, keywords: ['shampoo', 'soap', 'toothpaste', 'toothbrush', 'deodorant', 'tissue', 'cotton buds', 'razor', 'battery', 'bulb', 'diaper', 'sanitary napkin', 'lotion', 'sunscreen', 'face wash', 'mouthwash', 'comb', 'handwash'] },
    { id: 'other',     name: 'Other',              tone: 'grey',   custom: false, keywords: [] }
  ];

  /* ===================================================== LISTS ========== */
  var LISTS = [
    {
      id: 'l1',
      name: 'The weekly shop',
      kind: 'grocery',
      icon: 'cart',
      tint: 'green',
      shared: true,
      aisle: 'Produce',
      items: [
        { id: 'i1', name: 'Avocados',           qty: { n: 2,  u: 'pcs' },   cat: 'produce', aisle: 'Produce', owner: 'm1', done: true  },
        { id: 'i2', name: 'Cherry tomatoes',    qty: { n: 250, u: 'g' },     cat: 'produce', aisle: 'Produce', owner: 'm2', done: false },
        { id: 'i3', name: 'Bananas',            qty: { n: 1,  u: 'bunch' }, cat: 'produce', aisle: 'Produce', owner: 'm1', done: false },
        { id: 'i4', name: 'Fresh milk',         qty: { n: 1,  u: 'L' },     cat: 'dairy',   aisle: 'Dairy & eggs', owner: 'm3', done: true  },
        { id: 'i5', name: 'Free-range eggs',    qty: { n: 1,  u: 'dozen' }, cat: 'dairy',   aisle: 'Dairy & eggs', owner: 'm3', done: false },
        { id: 'i6', name: 'Sourdough bread',    qty: { n: 1,  u: 'loaf' },  cat: 'bakery',  aisle: 'Bakery', owner: 'm2', done: false },
        { id: 'i7', name: 'Dishwashing liquid', qty: { n: 1,  u: 'bottle' },cat: 'cleaning',aisle: 'Cleaning', owner: 'm4', done: false },
        { id: 'i8', name: 'Laundry detergent',  qty: { n: 1,  u: 'pouch' }, cat: 'cleaning',aisle: 'Cleaning', owner: 'm4', done: false }
      ]
    },
    {
      id: 'l2',
      name: 'Household tasks',
      kind: 'tasks',
      icon: 'tasks',
      tint: 'gold',
      shared: true,
      aisle: 'Chores',
      items: [
        { id: 't1', name: 'Take recycling out',       qty: { n: 1, u: 'pcs' }, aisle: 'Chores', owner: 'm3', done: false },
        { id: 't2', name: 'Book the plumber',         qty: { n: 1, u: 'pcs' }, aisle: 'Chores', owner: 'm1', done: false }
      ]
    },
    {
      id: 'l3',
      name: 'Birthday dinner',
      kind: 'event',
      icon: 'cake',
      tint: 'blue',
      shared: true,
      aisle: 'Party',
      items: [
        { id: 'e1', name: "Shane's birthday cake", qty: { n: 1, u: 'pcs' },    aisle: 'Party', owner: 'm1', done: false },
        { id: 'e2', name: 'Sparkling cider',       qty: { n: 2, u: 'bottle' },aisle: 'Party', owner: 'm2', done: false },
        { id: 'e3', name: 'Balloon bouquet',        qty: { n: 1, u: 'bunch' }, aisle: 'Party', owner: 'm2', done: false },
        { id: 'e4', name: 'Dinner plates',          qty: { n: 12, u: 'pcs' },  aisle: 'Party', owner: 'm3', done: false },
        { id: 'e5', name: 'Grocery top-up',         qty: { n: 1, u: 'pcs' },   aisle: 'Party', owner: 'm4', done: false },
        { id: 'e6', name: 'Playlist + speakers',    qty: { n: 1, u: 'pcs' },   aisle: 'Party', owner: 'm1', done: false }
      ]
    },
    {
      id: 'l4',
      name: 'Pantry & Inventory',
      kind: 'inventory',
      icon: 'box',
      tint: 'navy',
      shared: true,
      aisle: 'Pantry',
      items: [
        { id: 'p1', name: 'Rice (5 kg)',         qty: { n: 1, u: 'bag' },   aisle: 'Pantry', owner: 'm1', done: false },
        { id: 'p2', name: 'Cooking oil',         qty: { n: 2, u: 'bottle' }, aisle: 'Pantry', owner: 'm3', done: false },
        { id: 'p3', name: 'Instant coffee',     qty: { n: 1, u: 'can' },    aisle: 'Pantry', owner: 'm4', done: false }
      ]
    }
  ];

  /* ---------------------------------------------------------- pantry */
  var PANTRY = [
    { id: 'pa1', name: 'Rice (5 kg)',           qty: '1 sack',         expiry: 'Long shelf life',   level: 'full' },
    { id: 'pa2', name: 'Cooking oil',           qty: '2 bottles',      expiry: 'Best before 14 Nov', level: 'full' },
    { id: 'pa3', name: 'Instant coffee',        qty: '1 tin · 20 left',expiry: 'Best before 02 Dec',level: 'low'  },
    { id: 'pa4', name: 'Canned sardines',       qty: '6 cans',         expiry: 'Best before 25 Dec', level: 'full' },
    { id: 'pa5', name: 'All-purpose seasoning',qty: '1 bottle',       expiry: 'Best before 09 Nov', level: 'low'  }
  ];

  /* ---------------------------------------------------------- life admin */
  var LIFE_ADMIN = [
    { id: 'la1', name: 'Take recycling out',       when: 'Today', owner: 'm3', done: false },
    { id: 'la2', name: "Pick up Shane's birthday cake", when: 'Today', owner: 'm1', done: false },
    { id: 'la3', name: 'Confirm dinner reservation', when: 'Tomorrow', owner: 'm2', done: false }
  ];

  /* ------------------------------------------------------------ calendar */
  var EVENTS = [
    { id: 'ev1', date: iso(TODAY),        time: '10:00 AM', title: 'The weekly grocery run', kind: 'list',  chip: 'The weekly shop',   listId: 'l1' },
    { id: 'ev2', date: iso(dayOffset(1)), time: '6:00 PM',  title: "Shane's birthday dinner", kind: 'event', chip: 'Birthday dinner', listId: 'l3' },
    { id: 'ev5', date: iso(dayOffset(3)), time: '4:00 PM',  title: 'Pantry restock',          kind: 'list',  chip: 'Pantry & Inventory', listId: 'l4' },
    { id: 'ev3', date: iso(dayOffset(5)), time: '9:00 AM',  title: 'Household check-in',      kind: 'event', chip: 'Everyone',          listId: null  },
    { id: 'ev4', date: iso(dayOffset(9)), time: '7:30 PM',  title: 'Halloween movie night',   kind: 'event', chip: 'Family',            listId: null  }
  ];

  /* ------------------------------------------------------------ activity */
  var ACTIVITY = [
    { id: 'a1', who: 'Shane Lopez',   initials: 'SL', text: 'Shared added cherry tomatoes', when: '2 min ago', icon: 'share' },
    { id: 'a2', who: 'Qi Lopez',      initials: 'QL', text: 'Checked off oat milk',          when: '18 min ago', icon: 'check' },
    { id: 'a3', who: 'Alex Lopez',    initials: 'AL', text: 'Pushed the grocery run',        when: '1 hr ago',   icon: 'push' },
    { id: 'a4', who: 'Rainier Lopez', initials: 'RL', text: 'Joined the weekly shop',        when: 'Yesterday',  icon: 'join' }
  ];

  /* ------------------------------------------------------------ spending */
  var SPENDING = {
    range: 'w1',
    rangeOrder: ['w1', 'm1', 'm3', 'm6', 'y1'],
    rangeLabels: { w1: '1W', m1: '1M', m3: '3M', m6: '6M', y1: '1Y' },
    ranges: {
      w1: { label: 'This week',  amount: 3450,   budget: 4500,   period: 'this week',  delta: -12 },
      m1: { label: 'This month',  amount: 14260,  budget: 18000,  period: 'this month',  delta: -9  },
      m3: { label: '3 months',    amount: 41890,  budget: 54000,  period: '3 months',    delta: -6  },
      m6: { label: '6 months',    amount: 84220,  budget: 108000, period: '6 months',    delta: 4   },
      y1: { label: '12 months',   amount: 168400, budget: 216000, period: '12 months',   delta: -11 }
    },
    mini: {
      w1: { labels: ['M', 'T', 'W', 'T', 'F', 'S', 'S'], values: [520, 780, 610, 940, 0, 0, 0], hot: 3 },
      m1: { labels: ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4'], values: [3450, 3820, 3110, 3880], hot: 0 },
      m3: { labels: ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'], values: [13400, 14260, 15180, 12940, 16210, 14980], hot: 4 },
      m6: { labels: ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'], values: [13100, 13400, 14260, 15180, 12940, 16210], hot: 5 },
      y1: { labels: ['Q1', 'Q2', 'Q3', 'Q4'], values: [41200, 43800, 45180, 38220], hot: 2 }
    },
    chart: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      produce: [420, 610, 380, 520, 300, 640, 260],
      dairy:   [180, 240, 160, 210, 150, 280, 140],
      other:   [220, 310, 240, 280, 190, 350, 220]
    },
    breakdown: [
      { name: 'Produce',        amount: 1105, pct: 32 },
      { name: 'Dairy & eggs',   amount: 860,  pct: 25 },
      { name: 'Meat & poultry', amount: 690,  pct: 20 },
      { name: 'Bakery',         amount: 415,  pct: 12 },
      { name: 'Cleaning',       amount: 245,  pct: 7  },
      { name: 'Snacks',         amount: 135,  pct: 4  }
    ],
    stats: [
      { label: 'This week',     value: '₱3,450',  delta: '12% less than last week',  dir: 'down', icon: 'wallet' },
      { label: 'Average trip',  value: '₱690',    delta: '4 trips this week',        dir: 'down', icon: 'cart' },
      { label: 'Items bought',  value: '46',      delta: '8 more than last week',    dir: 'up',   icon: 'box' },
      { label: 'Budget left',   value: '₱1,050',  delta: '23% of the weekly cap',    dir: 'down', icon: 'chart' }
    ]
  };

  /* =================================================== CATALOGUE ======== */
  /* Common Philippine grocery products with the unit they are normally
     sold in. `alt` holds the Filipino / market aliases used by the search. */
  var CATALOGUE = [
    /* ---- produce ---- */
    { name: 'Avocados',            cat: 'produce', n: 2,   u: 'pcs',  alt: 'hass avocado, avocado' },
    { name: 'Bananas',             cat: 'produce', n: 1,   u: 'bunch',alt: 'saba, lakatan,香蕉' },
    { name: 'Lakatan banana',      cat: 'produce', n: 1,   u: 'bunch',alt: 'banana' },
    { name: 'Saba banana',         cat: 'produce', n: 1,   u: 'bunch',alt: 'banana' },
    { name: 'Cherry tomatoes',     cat: 'produce', n: 250, u: 'g',    alt: 'roma, tomato' },
    { name: 'Tomatoes',            cat: 'produce', n: 500, u: 'g',    alt: 'tomato' },
    { name: 'Calamansi',           cat: 'produce', n: 1,   u: 'kg',   alt: 'sampaloc, calamond, kalamansi' },
    { name: 'Mangoes',             cat: 'produce', n: 1,   u: 'kg',   alt: 'mangga, carabao mango' },
    { name: 'Carabao mango',       cat: 'produce', n: 1,   u: 'kg',   alt: 'mango' },
    { name: 'Pineapple',           cat: 'produce', n: 1,   u: 'pcs',  alt: 'pineapple' },
    { name: 'Papaya',              cat: 'produce', n: 1,   u: 'pcs',  alt: 'papaya' },
    { name: 'Ampalaya',            cat: 'produce', n: 3,   u: 'pcs',  alt: 'bitter melon, ampalaya' },
    { name: 'Sitao',               cat: 'produce', n: 1,   u: 'bunch',alt: 'string beans, sitao' },
    { name: 'Kangkung',            cat: 'produce', n: 1,   u: 'bunch',alt: 'water spinach, kangkong' },
    { name: 'Pechay',              cat: 'produce', n: 1,   u: 'bunch',alt: 'chinese pechay, pechay' },
    { name: 'Chinese cabbage',     cat: 'produce', n: 1,   u: 'pcs', alt: 'pechay, chinese cabbage' },
    { name: 'Labanos',             cat: 'produce', n: 1,   u: 'kg',   alt: 'radish, labanos' },
    { name: 'Carrots',             cat: 'produce', n: 500, u: 'g',    alt: 'carrot' },
    { name: 'Potatoes',            cat: 'produce', n: 1,   u: 'kg',   alt: 'potato' },
    { name: 'White potatoes',      cat: 'produce', n: 1,   u: 'kg',   alt: 'potato' },
    { name: 'Red onions',          cat: 'produce', n: 3,   u: 'pcs',  alt: 'onion, sibuyas' },
    { name: 'Garlic',              cat: 'produce', n: 1,   u: 'pcs', alt: 'bawang, garlic' },
    { name: 'Lemongrass',          cat: 'produce', n: 1,   u: 'bunch',alt: 'tanglad, lemongrass' },
    { name: 'Ginger',              cat: 'produce', n: 250, u: 'g',    alt: 'luya, ginger' },
    { name: 'Ube',                 cat: 'produce', n: 1,   u: 'kg',   alt: 'purple yam, ube' },
    { name: 'Taro',                cat: 'produce', n: 1,   u: 'kg',   alt: 'gabi, taro' },
    { name: 'Sweet potato',        cat: 'produce', n: 1,   u: 'kg',   alt: 'camote, sweet potato' },
    { name: 'Suyuk',               cat: 'produce', n: 1,   u: 'kg',   alt: 'pomelo' },
    { name: 'Pomelo',              cat: 'produce', n: 1,   u: 'kg',   alt: 'suyuk' },
    { name: 'Lanzones',            cat: 'produce', n: 1,   u: 'kg',   alt: 'lanzones' },
    { name: 'Rambutan',            cat: 'produce', n: 1,   u: 'kg',   alt: ' rambutan' },
    { name: 'Sayote',              cat: 'produce', n: 3,   u: 'pcs',  alt: 'sayote' },
    { name: 'Singkamas',           cat: 'produce', n: 1,   u: 'bunch',alt: 'jícama, singkamas' },
    { name: 'Suman',               cat: 'produce', n: 5,   u: 'pcs',  alt: 'rice cake, suman' },
    { name: 'Banana blossom',      cat: 'produce', n: 1,   u: 'bunch',alt: 'kumpintang' },
    { name: 'Okra',                cat: 'produce', n: 500, u: 'g',    alt: 'singkod' },
    { name: 'Eggplant',            cat: 'produce', n: 3,   u: 'pcs',  alt: 'talong, eggplant' },
    { name: 'Squash',              cat: 'produce', n: 1,   u: 'kg',   alt: 'kalabasa, squash' },
    { name: 'Chinese cabbage',     cat: 'produce', n: 1,   u: 'pcs', alt: 'pechay' },
    { name: 'Lettuce',             cat: 'produce', n: 1,   u: 'pcs', alt: 'salad' },
    { name: 'Cabbage',             cat: 'produce', n: 1,   u: 'pcs', alt: 'repolyo, cabbage' },
    { name: 'Baby spinach',        cat: 'produce', n: 200, u: 'g',    alt: 'spinach' },
    { name: 'Broccoli',            cat: 'produce', n: 1,   u: 'pcs',  alt: 'broccoli' },
    { name: 'Corn',                cat: 'produce', n: 2,   u: 'pcs',  alt: 'mais, sweet corn' },
    { name: 'Apples',              cat: 'produce', n: 3,   u: 'pcs',  alt: 'apple' },
    { name: 'Oranges',             cat: 'produce', n: 3,   u: 'pcs',  alt: 'orange' },
    { name: 'Grapes',              cat: 'produce', n: 500, u: 'g',    alt: 'grape' },
    { name: 'Mung bean sprouts',    cat: 'produce', n: 250, u: 'g',    alt: 'toyo, bean sprout' },
    { name: 'Water spinach',       cat: 'produce', n: 1,   u: 'bunch',alt: 'kangkung' },

    /* ---- rice & grains ---- */
    { name: 'Regular milled rice',  cat: 'grains', n: 5,   u: 'kg',   alt: 'bigas, regular rice, sinangag' },
    { name: 'Well milled rice',     cat: 'grains', n: 5,   u: 'kg',   alt: 'bigas, well milled' },
    { name: 'Premium rice',        cat: 'grains', n: 5,   u: 'kg',   alt: 'bigas, dinorado' },
    { name: 'Garlic rice',         cat: 'grains', n: 5,   u: 'kg',   alt: 'sinangag, garlic rice' },
    { name: 'Brown rice',          cat: 'grains', n: 1,   u: 'kg',   alt: 'bigas' },
    { name: 'Cornstarch',          cat: 'grains', n: 500, u: 'g',    alt: 'corn flour, cornstarch' },
    { name: 'All-purpose flour',   cat: 'grains', n: 1,   u: 'kg',   alt: 'arina, flour' },
    { name: 'Oats',                cat: 'grains', n: 500, u: 'g',    alt: 'oatmeal' },
    { name: 'Pancit noodles',      cat: 'grains', n: 4,   u: 'pack',alt: 'pancit, noodles' },
    { name: 'Misua',               cat: 'grains', n: 500, u: 'g',    alt: 'vermicelli' },
    { name: 'Spaghetti',           cat: 'grains', n: 500, u: 'g',    alt: 'pasta' },
    { name: 'Macaroni',            cat: 'grains', n: 500, u: 'g',    alt: 'pasta' },
    { name: 'Bihon',               cat: 'grains', n: 500, u: 'g',    alt: 'rice noodles' },
    { name: 'Sago',                cat: 'grains', n: 500, u: 'g',    alt: 'tapioca' },

    /* ---- meat & poultry ---- */
    { name: 'Chicken breast',       cat: 'meat', n: 500, u: 'g',    alt: 'chicken' },
    { name: 'Chicken leg quarters', cat: 'meat', n: 1,   u: 'kg',   alt: 'chicken' },
    { name: 'Whole chicken',        cat: 'meat', n: 1,   u: 'pcs',  alt: 'manok, chicken' },
    { name: 'Ground beef',          cat: 'meat', n: 500, u: 'g',    alt: 'minced beef, ground beef' },
    { name: 'Beef brisket',         cat: 'meat', n: 500, u: 'g',    alt: 'beef' },
    { name: 'Beef rump',            cat: 'meat', n: 500, u: 'g',    alt: 'beef' },
    { name: 'Pork liempo',          cat: 'meat', n: 500, u: 'g',    alt: 'pork belly' },
    { name: 'Pork ham',             cat: 'meat', n: 500, u: 'g',    alt: 'pork' },
    { name: 'Longganisa',           cat: 'meat', n: 500, u: 'g',    alt: 'philippine sausage, longganisa' },
    { name: 'Tocino',               cat: 'meat', n: 500, u: 'g',    alt: 'philippine tocino' },
    { name: 'Chorizo',              cat: 'meat', n: 500, u: 'g',    alt: 'spanish chorizo' },
    { name: 'Hot dogs',             cat: 'meat', n: 1,   u: 'pack', alt: 'hotdog' },
    { name: 'Bacon',                cat: 'meat', n: 250, u: 'g',    alt: 'bacon' },
    { name: 'Beef shank',           cat: 'meat', n: 500, u: 'g',    alt: 'beef' },

    /* ---- fish & seafood ---- */
    { name: 'Bangus',               cat: 'seafood', n: 1,   u: 'pcs',  alt: 'milkfish, bangus' },
    { name: 'Bangus belly',         cat: 'seafood', n: 500, u: 'g',    alt: 'bangus' },
    { name: 'Tilapia',              cat: 'seafood', n: 1,   u: 'pcs',  alt: 'tilapia' },
    { name: 'Galunggong',           cat: 'seafood', n: 500, u: 'g',    alt: 'round scad, galunggong' },
    { name: 'Aluminhas',            cat: 'seafood', n: 500, u: 'g',    alt: 'silver fish, aluminhas' },
    { name: 'Tuna',                 cat: 'seafood', n: 500, u: 'g',    alt: 'tuna' },
    { name: 'Squid',                cat: 'seafood', n: 500, u: 'g',    alt: 'pusit, squid' },
    { name: 'Shrimp',               cat: 'seafood', n: 500, u: 'g',    alt: 'hipon, shrimp' },
    { name: 'Aligue',               cat: 'seafood', n: 500, u: 'g',    alt: 'crab' },
    { name: 'Clams',                cat: 'seafood', n: 500, u: 'g',    alt: 'clam' },
    { name: 'Tuyo (dried fish)',    cat: 'seafood', n: 250, u: 'g',    alt: 'tuyo, dried fish' },
    { name: 'Daing',                cat: 'seafood', n: 250, u: 'g',    alt: 'dried fish' },
    { name: 'Dried shrimp',         cat: 'seafood', n: 100, u: 'g',    alt: 'shrimp paste, dried shrimp' },
    { name: 'Shrimp paste',         cat: 'seafood', n: 1,   u: 'bottle',  alt: 'bagoong, shrimp paste' },
    { name: 'Fish sauce',           cat: 'seafood', n: 1,   u: 'bottle', alt: 'patis, fish sauce' },

    /* ---- dairy & eggs ---- */
    { name: 'Fresh milk',           cat: 'dairy', n: 1,   u: 'L',    alt: 'milk' },
    { name: 'Oat milk',             cat: 'dairy', n: 1,   u: 'L',    alt: 'oat drink' },
    { name: 'Chocolate milk',       cat: 'dairy', n: 1,   u: 'L',    alt: 'milo, chocolate milk' },
    { name: 'Powdered milk',        cat: 'dairy', n: 1,   u: 'pouch',alt: 'powdered milk' },
    { name: 'Canned milk',          cat: 'dairy', n: 1,   u: 'can',  alt: 'evaporated milk' },
    { name: 'Condensed milk',       cat: 'dairy', n: 1,   u: 'can',  alt: 'condensada' },
    { name: 'Free-range eggs',      cat: 'dairy', n: 1,   u: 'dozen',alt: 'eggs, itlog' },
    { name: 'Salted duck egg',      cat: 'dairy', n: 1,   u: 'pcs',  alt: 'itlog, salted egg' },
    { name: 'Cheddar cheese',       cat: 'dairy', n: 250, u: 'g',    alt: 'cheese, cheddar' },
    { name: 'Mozzarella cheese',    cat: 'dairy', n: 250, u: 'g',    alt: 'cheese' },
    { name: 'Parmesan cheese',      cat: 'dairy', n: 100, u: 'g',    alt: 'cheese' },
    { name: 'Butter',               cat: 'dairy', n: 1,   u: 'pcs',  alt: 'butter' },
    { name: 'Margarine',            cat: 'dairy', n: 1,   u: 'pcs',  alt: 'margarine' },
    { name: 'Greek yoghurt',        cat: 'dairy', n: 500, u: 'g',    alt: 'yogurt' },
    { name: 'Cream',                cat: 'dairy', n: 250, u: 'ml',   alt: 'all purpose cream' },

    /* ---- bakery ---- */
    { name: 'Sourdough bread',      cat: 'bakery', n: 1,   u: 'loaf', alt: 'bread' },
    { name: 'Pandesal',             cat: 'bakery', n: 6,   u: 'pcs',  alt: 'bread roll, pandesal' },
    { name: 'Kaiser roll',          cat: 'bakery', n: 6,   u: 'pcs',  alt: 'bread' },
    { name: 'Spanish bread',        cat: 'bakery', n: 1,   u: 'pcs',  alt: 'pandesal' },
    { name: 'White bread',          cat: 'bakery', n: 1,   u: 'loaf', alt: 'bread' },
    { name: 'Baguette',             cat: 'bakery', n: 1,   u: 'pcs',  alt: 'bread' },
    { name: 'Croissant',            cat: 'bakery', n: 1,   u: 'pcs',  alt: 'pastry' },
    { name: 'Chocolate chip cookie',cat: 'bakery', n: 1,   u: 'pack', alt: 'cookies' },
    { name: 'Donut',                cat: 'bakery', n: 1,   u: 'pcs',  alt: 'doughnut' },
    { name: 'Tortilla',             cat: 'bakery', n: 1,   u: 'pack', alt: 'wrap' },

    /* ---- canned & dried ---- */
    { name: 'Sardines',             cat: 'canned', n: 1,   u: 'can',  alt: 'tinapa, sardines' },
    { name: 'Corned beef',          cat: 'canned', n: 1,   u: 'can',  alt: 'corned beef' },
    { name: 'Canned tuna',          cat: 'canned', n: 1,   u: 'can',  alt: 'tuna' },
    { name: 'Canned sardines',      cat: 'canned', n: 1,   u: 'can',  alt: 'sardines' },
    { name: 'Canned milk',          cat: 'canned', n: 1,   u: 'can',  alt: 'evaporated milk' },
    { name: 'Coconut milk',         cat: 'canned', n: 1,   u: 'can',  alt: 'gata, coconut milk' },
    { name: 'Pineapple slices',     cat: 'canned', n: 1,   u: 'can',  alt: 'pineapple' },
    { name: 'Peanuts',              cat: 'canned', n: 200, u: 'g',    alt: 'munggo, peanuts' },
    { name: 'Pili nut',             cat: 'canned', n: 200, u: 'g',    alt: 'pili nut' },
    { name: 'Cashew nuts',          cat: 'canned', n: 200, u: 'g',    alt: 'cashew' },
    { name: 'Dried fish',           cat: 'canned', n: 250, u: 'g',    alt: 'tuyo' },
    { name: 'Raisins',              cat: 'canned', n: 200, u: 'g',    alt: 'raisins' },
    { name: 'Honey',                cat: 'canned', n: 1,   u: 'bottle',  alt: 'honey' },
    { name: 'Jam',                  cat: 'canned', n: 1,   u: 'bottle',  alt: 'jam' },

    /* ---- sauces & condiments ---- */
    { name: 'Soy sauce',            cat: 'condiments', n: 1, u: 'bottle', alt: 'toyo, soy sauce' },
    { name: 'Datu Puti soy sauce',  cat: 'condiments', n: 1, u: 'bottle', alt: 'soy sauce, datu puti' },
    { name: 'Cane vinegar',         cat: 'condiments', n: 1, u: 'bottle', alt: 'sukang, vinegar' },
    { name: 'Spiced vinegar',       cat: 'condiments', n: 1, u: 'bottle', alt: 'sukang, spiced vinegar' },
    { name: 'Bagoong',              cat: 'condiments', n: 1, u: 'bottle',    alt: 'shrimp paste, bagoong' },
    { name: 'Tomato ketchup',       cat: 'condiments', n: 1, u: 'bottle', alt: 'ketchup' },
    { name: 'Banana ketchup',       cat: 'condiments', n: 1, u: 'bottle', alt: 'ketchup' },
    { name: 'Mayonnaise',           cat: 'condiments', n: 1, u: 'pouch',  alt: 'mayonnaise' },
    { name: 'Salamat',              cat: 'condiments', n: 1, u: 'pouch',  alt: 'margarine, salamat' },
    { name: 'Sambal',               cat: 'condiments', n: 1, u: 'bottle',    alt: 'sambal, chili' },
    { name: 'Toyomansi',            cat: 'condiments', n: 1, u: 'bottle', alt: 'calamansi, toyomansi' },
    { name: 'Dayok',                cat: 'condiments', n: 1, u: 'pouch',  alt: 'dayok' },
    { name: 'Atchara',              cat: 'condiments', n: 1, u: 'bottle',    alt: 'pickled, atchara' },
    { name: 'Peanut sauce',         cat: 'condiments', n: 1, u: 'bottle',    alt: 'peanut sauce' },
    { name: 'Oyster sauce',         cat: 'condiments', n: 1, u: 'bottle', alt: 'oyster sauce' },

    /* ---- snacks & sweets ---- */
    { name: 'Potato chips',         cat: 'snacks', n: 1,   u: 'pack',  alt: 'chips, crps' },
    { name: 'Chocolate bars',       cat: 'snacks', n: 1,   u: 'pack',  alt: 'chocolate' },
    { name: 'Biscuits',             cat: 'snacks', n: 1,   u: 'pack',  alt: 'cookies, biscuits' },
    { name: 'Chicharon',            cat: 'snacks', n: 500, u: 'g',    alt: 'chicharon, pork crackling' },
    { name: 'Prawn cracker',        cat: 'snacks', n: 100, u: 'g',    alt: 'krupuk, prawn cracker' },
    { name: 'Kwek kwek',            cat: 'snacks', n: 1,   u: 'pack',  alt: 'kwek kwek' },
    { name: 'Fish ball',            cat: 'snacks', n: 500, u: 'g',    alt: 'fish ball' },
    { name: 'Lumpia',               cat: 'snacks', n: 12,  u: 'pcs',  alt: 'spring roll, lumpia' },
    { name: 'Siopao',               cat: 'snacks', n: 4,   u: 'pcs',  alt: 'steamed bun, siopao' },
    { name: 'Turon',                cat: 'snacks', n: 1,   u: 'pcs',  alt: 'banana roll' },
    { name: 'Peanut brittle',       cat: 'snacks', n: 200, u: 'g',    alt: 'p peanuts' },
    { name: 'Popcorn',              cat: 'snacks', n: 1,   u: 'pack',  alt: 'popcorn' },

    /* ---- beverages ---- */
    { name: 'Coca-Cola',            cat: 'beverages', n: 1,   u: 'bottle', alt: 'coke, soda' },
    { name: 'Sprite',               cat: 'beverages', n: 1,   u: 'bottle', alt: 'soda' },
    { name: 'Royal',                cat: 'beverages', n: 1,   u: 'bottle', alt: 'soda' },
    { name: 'Milo',                 cat: 'beverages', n: 1,   u: 'L',     alt: 'chocolate drink, milo' },
    { name: 'Orange juice',         cat: 'beverages', n: 1,   u: 'L',     alt: 'juice' },
    { name: 'Fruit juice tetra',    cat: 'beverages', n: 1,   u: 'pcs',   alt: 'juice pack' },
    { name: 'Bottled water',        cat: 'beverages', n: 1,   u: 'pcs',   alt: 'water' },
    { name: 'Kapeng barako',        cat: 'beverages', n: 250, u: 'g',     alt: 'coffee, kapeng' },
    { name: 'Instant coffee',       cat: 'beverages', n: 100, u: 'g',     alt: 'coffee, nescafe' },
    { name: 'Ground coffee',        cat: 'beverages', n: 250, u: 'g',     alt: 'kape, coffee beans' },
    { name: 'Salabat',              cat: 'beverages', n: 1,   u: 'bottle', alt: 'tea, salabat' },
    { name: 'Alcoholic beverage',   cat: 'beverages', n: 1,   u: 'bottle', alt: 'beer, liquor' },

    /* ---- frozen ---- */
    { name: 'Ice cream',            cat: 'frozen', n: 1,   u: 'pcs',   alt: 'ice cream' },
    { name: 'Frozen chicken',       cat: 'frozen', n: 1,   u: 'pack',  alt: 'frozen chicken' },
    { name: 'Frozen fish fillet',   cat: 'frozen', n: 500, u: 'g',     alt: 'frozen fish' },
    { name: 'Ice pack',             cat: 'frozen', n: 5,   u: 'pcs',   alt: 'ice' },

    /* ---- cleaning ---- */
    { name: 'Dishwashing liquid',   cat: 'cleaning', n: 1,   u: 'bottle', alt: 'dish soap, dishwashing' },
    { name: 'Dishwashing tablets',  cat: 'cleaning', n: 1,   u: 'box',    alt: 'dishwasher tablet' },
    { name: 'Laundry detergent',    cat: 'cleaning', n: 1,   u: 'pouch',  alt: 'detergent, laundry' },
    { name: 'Powdered detergent',   cat: 'cleaning', n: 1,   u: 'pack',   alt: 'detergent' },
    { name: 'Fabric softener',      cat: 'cleaning', n: 1,   u: 'bottle', alt: 'downy, softener' },
    { name: 'Dishwashing sponge',   cat: 'cleaning', n: 1,   u: 'pack',   alt: 'sponge' },
    { name: 'Scouring powder',      cat: 'cleaning', n: 1,   u: 'pouch',  alt: 'scouring powder' },
    { name: 'Garbage bags',         cat: 'cleaning', n: 1,   u: 'pack',   alt: 'trash bag, basahan' },
    { name: 'Paper towels',         cat: 'cleaning', n: 1,   u: 'pack',   alt: 'kitchen towel' },
    { name: 'Tissues',              cat: 'cleaning', n: 1,   u: 'pack',   alt: 'tissue' },
    { name: 'Multipurpose cleaner', cat: 'cleaning', n: 1,   u: 'bottle', alt: 'surface spray, cleaner' },
    { name: 'Bleach',               cat: 'cleaning', n: 1,   u: 'bottle', alt: 'chlorine, bleach' },
    { name: 'Glass cleaner',        cat: 'cleaning', n: 1,   u: 'bottle', alt: 'glass cleaner' },
    { name: 'Floor cleaner',        cat: 'cleaning', n: 1,   u: 'pouch',  alt: 'floor cleaner' },
    { name: 'Aluminium foil',       cat: 'cleaning', n: 1,   u: 'pack',   alt: 'foil' },
    { name: 'Mop',                  cat: 'cleaning', n: 1,   u: 'pcs',   alt: 'mop' },

    /* ---- household & personal care ---- */
    { name: 'Bath soap',            cat: 'household', n: 1,  u: 'pcs',    alt: 'soap, bath soap' },
    { name: 'Laundry soap',         cat: 'household', n: 1,  u: 'pcs',    alt: 'soap' },
    { name: 'Shampoo',              cat: 'household', n: 1,  u: 'bottle', alt: 'shampoo' },
    { name: 'Toothpaste',           cat: 'household', n: 1,  u: 'pcs',    alt: 'toothpaste' },
    { name: 'Toothbrush',           cat: 'household', n: 1,  u: 'pcs',    alt: 'toothbrush' },
    { name: 'Colgate toothpaste',    cat: 'household', n: 1,  u: 'pcs',    alt: 'toothpaste, colgate' },
    { name: 'Deodorant',            cat: 'household', n: 1,  u: 'pcs',    alt: 'deodorant' },
    { name: 'Alcohol',              cat: 'household', n: 1,  u: 'bottle', alt: 'rubbing alcohol' },
    { name: 'Cotton buds',          cat: 'household', n: 1,  u: 'pack',   alt: 'cotton buds' },
    { name: 'Batteries AA',         cat: 'household', n: 4,  u: 'pcs',    alt: 'battery' },
    { name: 'LED bulb',             cat: 'household', n: 1,  u: 'pcs',    alt: 'light bulb' },
    { name: 'Insecticide',          cat: 'household', n: 1,  u: 'can',    alt: 'aerosol, insecticide' },
    { name: 'Air freshener',        cat: 'household', n: 1,  u: 'can',    alt: 'air freshener' },
    { name: 'Baby diapers',         cat: 'household', n: 1,  u: 'pack',   alt: 'diapers' },
    { name: 'Sanitary napkins',     cat: 'household', n: 1,  u: 'pack',   alt: 'sanitary napkin' },
    { name: 'Baking soda',          cat: 'household', n: 1,  u: 'box',    alt: 'bicarbonate' }
  ];

  /* What this household has bought before — surfaced first in the suggestions. */
  var HISTORY = [
    { name: 'Dishwashing liquid', cat: 'cleaning',  n: 1,   u: 'bottle', times: 6, when: '2 weeks ago' },
    { name: 'Laundry detergent',   cat: 'cleaning',  n: 1,   u: 'pouch',  times: 4, when: '1 week ago' },
    { name: 'Paper towels',        cat: 'cleaning',  n: 1,   u: 'pack',   times: 3, when: '3 weeks ago' },
    { name: 'Oat milk',            cat: 'dairy',     n: 1,   u: 'L',      times: 9, when: '4 days ago' },
    { name: 'Free-range eggs',     cat: 'dairy',     n: 1,   u: 'dozen',  times: 5, when: '3 days ago' },
    { name: 'Cherry tomatoes',     cat: 'produce',   n: 250, u: 'g',      times: 7, when: '2 days ago' },
    { name: 'Bananas',             cat: 'produce',   n: 1,   u: 'bunch',  times: 11, when: 'yesterday' },
    { name: 'Sourdough bread',     cat: 'bakery',    n: 1,   u: 'loaf',   times: 8, when: '2 days ago' },
    { name: 'Chicken breast',      cat: 'meat',      n: 500, u: 'g',      times: 2, when: '1 week ago' },
    { name: 'Regular milled rice', cat: 'grains',    n: 5,   u: 'kg',     times: 3, when: '1 week ago' },
    { name: 'Calamansi',           cat: 'produce',   n: 1,   u: 'kg',     times: 5, when: '2 days ago' },
    { name: 'Canned sardines',     cat: 'canned',    n: 1,   u: 'can',    times: 6, when: '3 days ago' }
  ];

  global.BiliList = {
    NOW: NOW,
    TODAY: TODAY,
    iso: iso,
    dayOffset: dayOffset,
    members: MEMBERS,
    workspaces: WORKSPACES,
    lists: LISTS,
    pantry: PANTRY,
    lifeAdmin: LIFE_ADMIN,
    events: EVENTS,
    activity: ACTIVITY,
    spending: SPENDING,
    categories: CATEGORIES,
    units: UNITS,
    catalogue: CATALOGUE,
    history: HISTORY
  };
})(window);
