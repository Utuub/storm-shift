// Every product in the store. Counts get nudged (within 3-10) so the
// store always holds exactly TOTAL_ITEMS items.

export const TOTAL_ITEMS = 1500;
export const MIN_PER = 3;
export const MAX_PER = 10;

// kind: box [w, h, d] | cyl [r, h] | ball [r]. Units are meters, scaled up
// about 1.4x from real life so items are easy to aim at.
export const SHAPES = {
  ball_s:   { kind: 'ball', size: [0.045] },
  ball_m:   { kind: 'ball', size: [0.06] },
  ball_l:   { kind: 'ball', size: [0.11] },
  bunch:    { kind: 'box', size: [0.22, 0.07, 0.12] },
  jug:      { kind: 'box', size: [0.17, 0.3, 0.17] },
  carton:   { kind: 'box', size: [0.11, 0.26, 0.11] },
  carton_s: { kind: 'box', size: [0.08, 0.17, 0.08] },
  stick:    { kind: 'box', size: [0.14, 0.06, 0.08] },
  eggs:     { kind: 'box', size: [0.3, 0.08, 0.12] },
  pouch:    { kind: 'box', size: [0.15, 0.2, 0.04] },
  slices:   { kind: 'box', size: [0.15, 0.04, 0.15] },
  tub:      { kind: 'cyl', size: [0.065, 0.1] },
  tub_l:    { kind: 'cyl', size: [0.09, 0.14] },
  pizza:    { kind: 'box', size: [0.32, 0.05, 0.32] },
  bag_s:    { kind: 'box', size: [0.18, 0.24, 0.05] },
  box_m:    { kind: 'box', size: [0.2, 0.26, 0.07] },
  box_s:    { kind: 'box', size: [0.13, 0.16, 0.05] },
  box_long: { kind: 'box', size: [0.3, 0.07, 0.07] },
  can:      { kind: 'cyl', size: [0.05, 0.13] },
  can_s:    { kind: 'cyl', size: [0.045, 0.07] },
  can_l:    { kind: 'cyl', size: [0.075, 0.18] },
  can_tall: { kind: 'cyl', size: [0.035, 0.16] },
  loaf:     { kind: 'box', size: [0.14, 0.14, 0.32] },
  buns:     { kind: 'box', size: [0.22, 0.1, 0.3] },
  jar:      { kind: 'cyl', size: [0.055, 0.15] },
  jar_l:    { kind: 'cyl', size: [0.08, 0.22] },
  bottle:   { kind: 'cyl', size: [0.045, 0.25] },
  bottle_s: { kind: 'cyl', size: [0.03, 0.15] },
  bottle_l: { kind: 'cyl', size: [0.06, 0.36] },
  bottle_f: { kind: 'box', size: [0.09, 0.22, 0.05] },
  tray:     { kind: 'box', size: [0.24, 0.07, 0.18] },
  pack6:    { kind: 'box', size: [0.3, 0.22, 0.2] },
  chips:    { kind: 'box', size: [0.24, 0.32, 0.08] },
  cereal:   { kind: 'box', size: [0.26, 0.36, 0.09] },
  flour:    { kind: 'box', size: [0.16, 0.26, 0.1] },
  bigbag:   { kind: 'box', size: [0.32, 0.42, 0.12] },
  roll:     { kind: 'cyl', size: [0.08, 0.26] },
  tp:       { kind: 'box', size: [0.3, 0.3, 0.2] },
  spice:    { kind: 'cyl', size: [0.03, 0.1] },
  dome:     { kind: 'box', size: [0.22, 0.15, 0.22] },
  plates:   { kind: 'box', size: [0.26, 0.08, 0.26] },
};

// [name, shape, color, count]
export const SECTIONS = [
  { name: 'Produce', color: '#3f9b3a', products: [
    ['Red Apples', 'ball_m', '#c8202a', 8], ['Green Apples', 'ball_m', '#7cc04b', 7],
    ['Oranges', 'ball_m', '#f28a1c', 9], ['Lemons', 'ball_s', '#f5d63a', 6],
    ['Limes', 'ball_s', '#5aa832', 6], ['Bananas', 'bunch', '#f3d34a', 7],
    ['Tomatoes', 'ball_m', '#e0412d', 8], ['Russet Potatoes', 'ball_m', '#9c7547', 9],
    ['Yellow Onions', 'ball_m', '#d9b46a', 7], ['Avocados', 'ball_s', '#3d5a26', 6],
    ['Peaches', 'ball_m', '#f6a777', 5], ['Cantaloupe', 'ball_l', '#d8c38c', 3],
  ]},
  { name: 'Dairy', color: '#4f8fd6', products: [
    ['Whole Milk Gallon', 'jug', '#d93b3b', 6], ['2% Milk Gallon', 'jug', '#2d6fd1', 6],
    ['Chocolate 2% Milk', 'carton', '#6b3b1f', 5], ['Skim Milk', 'carton', '#7fb2e8', 5],
    ['Salted Butter', 'stick', '#f4d35e', 6], ['Large Eggs', 'eggs', '#e9dcc4', 6],
    ['Shredded Cheddar', 'pouch', '#f29b26', 7], ['Sliced Swiss', 'slices', '#f6e7a1', 5],
    ['Strawberry Yogurt', 'tub', '#e85c8a', 8], ['Greek Yogurt', 'tub', '#3a5fa8', 7],
    ['Sour Cream', 'tub', '#3f8f6f', 5], ['Cottage Cheese', 'tub', '#2f7fc1', 4],
  ]},
  { name: 'Frozen', color: '#7ad0f0', products: [
    ['Pepperoni Pizza', 'pizza', '#b3261e', 5], ['Cheese Pizza', 'pizza', '#e8a33a', 5],
    ['Vanilla Ice Cream', 'tub_l', '#f3e6c4', 6], ['Chocolate Ice Cream', 'tub_l', '#5a3420', 6],
    ['Frozen Peas', 'bag_s', '#3d9b3d', 7], ['Mixed Vegetables', 'bag_s', '#e2783a', 7],
    ['Fish Sticks', 'box_m', '#2a6aa8', 5], ['Chicken Nuggets', 'bag_s', '#d9a441', 7],
    ['Frozen Waffles', 'box_m', '#d6a24c', 6], ['Bean Burritos', 'box_s', '#9b4a2a', 8],
    ['Tater Tots', 'bag_s', '#c79a3a', 6], ['Fruit Bars', 'box_s', '#c03a8a', 5],
  ]},
  { name: 'Canned Goods', color: '#c0392b', products: [
    ['Chicken Noodle Soup', 'can', '#c8302c', 9], ['Tomato Soup', 'can', '#e0522a', 8],
    ['Green Beans', 'can', '#3a8f3a', 7], ['Sweet Corn', 'can', '#f0c53a', 7],
    ['Black Beans', 'can', '#2b2b2b', 6], ['Kidney Beans', 'can', '#8a2a2a', 6],
    ['Diced Tomatoes', 'can', '#d8432f', 8], ['Chunk Light Tuna', 'can_s', '#2a5f9e', 10],
    ['Peaches in Syrup', 'can', '#f39a4a', 5], ['Beef Chili', 'can', '#7a2f1a', 6],
    ['Cream of Mushroom', 'can', '#b8a58a', 6], ['Pumpkin Puree', 'can', '#e57b25', 4],
  ]},
  { name: 'Pasta & Rice', color: '#e6b422', products: [
    ['Spaghetti', 'box_long', '#2a4fa0', 8], ['Penne', 'box_m', '#2a4fa0', 7],
    ['Elbow Macaroni', 'box_m', '#e2c23a', 7], ['Rotini', 'box_m', '#3a8a5a', 6],
    ['Lasagna Noodles', 'box_long', '#b83a2a', 4], ['Egg Noodles', 'bag_s', '#f2d16a', 6],
    ['Mac & Cheese', 'box_s', '#f28c1c', 10], ['White Rice', 'flour', '#f2f0e6', 6],
    ['Brown Rice', 'flour', '#9a7448', 5], ['Ramen Noodles', 'box_s', '#d43a2a', 10],
    ['Couscous', 'box_s', '#c9a24a', 4], ['Orzo', 'box_s', '#6a8a3a', 4],
  ]},
  { name: 'Bread & Bakery', color: '#b5793b', products: [
    ['White Bread', 'loaf', '#f3e3b0', 7], ['Wheat Bread', 'loaf', '#a06a35', 7],
    ['Sourdough', 'loaf', '#d8b47a', 5], ['Hamburger Buns', 'buns', '#e8c27a', 6],
    ['Hot Dog Buns', 'buns', '#e3b46a', 6], ['Plain Bagels', 'buns', '#c99a5a', 5],
    ['English Muffins', 'box_s', '#e9d8b4', 6], ['Flour Tortillas', 'slices', '#f0e2c2', 6],
    ['Croissants', 'dome', '#d79a4a', 4], ['Dinner Rolls', 'buns', '#d9a35a', 5],
    ['Blueberry Muffins', 'dome', '#5a4a9a', 4], ['Rye Bread', 'loaf', '#7a5a3a', 4],
  ]},
  { name: 'Sauces & Condiments', color: '#d35400', products: [
    ['Marinara Sauce', 'jar', '#b8281e', 8], ['Alfredo Sauce', 'jar', '#efe6cf', 6],
    ['Ketchup', 'bottle', '#d0201a', 8], ['Yellow Mustard', 'bottle', '#f2d21a', 7],
    ['Mayonnaise', 'jar', '#f6f2e2', 6], ['BBQ Sauce', 'bottle', '#5a2a16', 6],
    ['Hot Sauce', 'bottle_s', '#d8401a', 8], ['Ranch Dressing', 'bottle', '#e9ece0', 6],
    ['Italian Dressing', 'bottle', '#c9a23a', 5], ['Soy Sauce', 'bottle', '#2a1a12', 6],
    ['Chunky Salsa', 'jar', '#c8452a', 6], ['Dill Pickles', 'jar_l', '#7a9a3a', 4],
  ]},
  { name: 'Meat & Seafood', color: '#a93226', products: [
    ['Ground Beef', 'tray', '#b8323a', 8], ['Chicken Breasts', 'tray', '#f1b8a8', 8],
    ['Pork Chops', 'tray', '#e89a8a', 6], ['Ribeye Steak', 'tray', '#9a2a2a', 4],
    ['Chicken Thighs', 'tray', '#e8a898', 6], ['Thick Cut Bacon', 'slices', '#c84a3a', 7],
    ['Breakfast Sausage', 'box_s', '#c8743a', 6], ['Beef Hot Dogs', 'box_long', '#c8382a', 7],
    ['Salmon Fillet', 'tray', '#f08a5a', 4], ['Frozen Shrimp', 'bag_s', '#f4a07a', 5],
    ['Ground Turkey', 'tray', '#d8a090', 5], ['Bratwurst', 'box_long', '#a8582a', 5],
  ]},
  { name: 'Drinks', color: '#16a085', products: [
    ['Cola 2-Liter', 'bottle_l', '#8a1a1a', 8], ['Lemon-Lime Soda', 'bottle_l', '#3aa83a', 7],
    ['Orange Juice', 'carton', '#f29a1a', 7], ['Apple Juice', 'bottle', '#d8a02a', 6],
    ['Spring Water 6-Pack', 'pack6', '#5ab0e8', 6], ['Sparkling Water', 'can', '#8ad8e8', 9],
    ['Sweet Iced Tea', 'bottle', '#8a4a1a', 6], ['Pink Lemonade', 'carton', '#f08ab0', 5],
    ['Blue Sports Drink', 'bottle', '#2a6ae8', 7], ['Energy Drink', 'can_tall', '#1a1a1a', 9],
    ['Root Beer', 'bottle_l', '#5a2a12', 5], ['Grape Juice', 'bottle', '#5a1a6a', 4],
  ]},
  { name: 'Chips & Snacks', color: '#f39c12', products: [
    ['Potato Chips', 'chips', '#f2d21a', 8], ['BBQ Chips', 'chips', '#8a3a1a', 7],
    ['Tortilla Chips', 'chips', '#e8a02a', 7], ['Cheese Puffs', 'chips', '#f2781a', 6],
    ['Pretzel Twists', 'chips', '#2a5aa8', 6], ['Microwave Popcorn', 'box_m', '#d8282a', 6],
    ['Corn Chips', 'chips', '#c8a01a', 5], ['Cheddar Crackers', 'box_m', '#e8501a', 6],
    ['Salted Peanuts', 'jar', '#3a5aa8', 5], ['Trail Mix', 'pouch', '#5a8a3a', 6],
    ['Pork Rinds', 'chips', '#c87a3a', 4], ['Rice Cakes', 'roll', '#e8e2c8', 4],
  ]},
  { name: 'Cereal & Breakfast', color: '#e67e22', products: [
    ['Corn Flakes', 'cereal', '#f2c21a', 7], ['Honey Oat Cereal', 'cereal', '#d89a2a', 7],
    ['Chocolate Puffs', 'cereal', '#5a2a1a', 6], ['Fruit Rings', 'cereal', '#e83a8a', 6],
    ['Bran Flakes', 'cereal', '#8a5a2a', 4], ['Rolled Oats', 'can_l', '#3a6aa8', 5],
    ['Instant Oatmeal', 'box_m', '#7a4a2a', 6], ['Granola', 'pouch', '#a87a3a', 5],
    ['Pancake Mix', 'box_m', '#e8c26a', 5], ['Maple Syrup', 'bottle', '#a85a1a', 5],
    ['Toaster Pastries', 'box_m', '#3a8ae8', 6], ['Peanut Butter', 'jar', '#b8742a', 7],
  ]},
  { name: 'Baking', color: '#bdc3c7', products: [
    ['All-Purpose Flour', 'flour', '#f4f1e8', 6], ['Granulated Sugar', 'flour', '#e8eef4', 6],
    ['Brown Sugar', 'box_s', '#8a5a2a', 5], ['Baking Soda', 'box_s', '#f2781a', 6],
    ['Baking Powder', 'can_s', '#d8282a', 5], ['Vanilla Extract', 'bottle_s', '#3a2a1a', 6],
    ['Chocolate Chips', 'pouch', '#5a2a1a', 7], ['Yellow Cake Mix', 'box_m', '#f2c23a', 6],
    ['Chocolate Frosting', 'tub', '#4a2a1a', 6], ['Vegetable Oil', 'bottle_l', '#e8d84a', 4],
    ['Cornmeal', 'flour', '#f2d26a', 4], ['Powdered Sugar', 'flour', '#f6f6f6', 4],
  ]},
  { name: 'Candy', color: '#e84393', products: [
    ['Milk Chocolate Bars', 'box_s', '#5a2a1a', 10], ['Gummy Bears', 'pouch', '#e83a3a', 8],
    ['Sour Worms', 'pouch', '#8ae83a', 7], ['Peanut Butter Cups', 'box_s', '#f28a1a', 8],
    ['Red Licorice', 'pouch', '#c8102a', 6], ['Lollipops', 'box_s', '#e85ab8', 5],
    ['Peppermints', 'can_s', '#e8f2f2', 6], ['Soft Caramels', 'pouch', '#c8822a', 5],
    ['Jelly Beans', 'pouch', '#8a3ae8', 6], ['Candy Corn', 'pouch', '#f2a21a', 4],
    ['Chewing Gum', 'box_s', '#3ac8e8', 9], ['English Toffee', 'box_s', '#b8743a', 4],
  ]},
  { name: 'Coffee & Tea', color: '#6f4e37', products: [
    ['Ground Coffee', 'can_l', '#c8282a', 7], ['Whole Bean Coffee', 'bag_s', '#3a2216', 6],
    ['Decaf Coffee', 'can_l', '#2a8a4a', 4], ['Instant Coffee', 'jar', '#5a3a2a', 5],
    ['Coffee Pods', 'box_m', '#2a2a2a', 6], ['Green Tea', 'box_s', '#5aa83a', 6],
    ['Black Tea', 'box_s', '#c82a2a', 6], ['Chamomile Tea', 'box_s', '#f2d25a', 5],
    ['Hot Cocoa Mix', 'box_m', '#6a3a2a', 6], ['Coffee Creamer', 'bottle', '#e8e2d8', 6],
    ['Clover Honey', 'bottle', '#e8a01a', 5], ['Cold Brew', 'bottle', '#2a1a12', 4],
  ]},
  { name: 'Deli', color: '#c0392b', products: [
    ['Sliced Turkey', 'slices', '#e8c8a8', 7], ['Honey Ham', 'slices', '#e89aa0', 7],
    ['Genoa Salami', 'slices', '#a8323a', 5], ['Roast Beef', 'slices', '#8a3a2a', 5],
    ['Provolone', 'slices', '#f2e8c2', 5], ['Pepper Jack', 'slices', '#f2e2b2', 5],
    ['Potato Salad', 'tub_l', '#f2e28a', 4], ['Coleslaw', 'tub_l', '#c8e2a8', 4],
    ['Hummus', 'tub', '#c8a26a', 6], ['Rotisserie Chicken', 'dome', '#b8742a', 4],
    ['Pasta Salad', 'tub_l', '#e8b25a', 4], ['Pimento Cheese', 'tub', '#f28a3a', 4],
  ]},
  { name: 'Cleaning', color: '#2980b9', products: [
    ['Dish Soap', 'bottle_f', '#3ab8e8', 7], ['Laundry Detergent', 'jug', '#f2781a', 5],
    ['Bleach', 'jug', '#f2f2f2', 5], ['Glass Cleaner', 'bottle', '#3a8ae8', 5],
    ['All-Purpose Spray', 'bottle', '#5ac83a', 6], ['Scrub Sponges', 'box_s', '#f2d21a', 8],
    ['Trash Bags', 'box_m', '#2a2a2a', 6], ['Dishwasher Pods', 'tub_l', '#2a5ab8', 5],
    ['Fabric Softener', 'jug', '#a87ae8', 4], ['Floor Cleaner', 'bottle_l', '#e8c83a', 4],
    ['Scrub Brush', 'box_s', '#e83a3a', 4], ['Rubber Gloves', 'pouch', '#f2e21a', 5],
  ]},
  { name: 'Paper Goods', color: '#95a5a6', products: [
    ['Paper Towels', 'roll', '#f6f6f2', 8], ['Toilet Paper 12-Pack', 'tp', '#e8f0f8', 6],
    ['Facial Tissues', 'box_m', '#8ac8e8', 6], ['Paper Plates', 'plates', '#f2f2ea', 5],
    ['Napkins', 'stick', '#f6f6f6', 6], ['Aluminum Foil', 'box_long', '#9aa8b8', 5],
    ['Plastic Wrap', 'box_long', '#d84a3a', 4], ['Zipper Bags', 'box_m', '#3a6ae8', 6],
    ['Paper Cups', 'roll', '#e8e2c8', 5], ['Coffee Filters', 'box_s', '#f2e8d8', 4],
    ['Parchment Paper', 'box_long', '#c8b28a', 4], ['Plastic Forks', 'box_s', '#e8e8e8', 4],
  ]},
  { name: 'Health & Beauty', color: '#9b59b6', products: [
    ['Shampoo', 'bottle_f', '#5a8ae8', 7], ['Conditioner', 'bottle_f', '#e85aa8', 6],
    ['Body Wash', 'bottle_f', '#3ac8a8', 6], ['Toothpaste', 'box_long', '#e83a3a', 8],
    ['Toothbrushes', 'box_s', '#3ab8e8', 6], ['Deodorant', 'can_tall', '#2a3a6a', 7],
    ['Bar Soap', 'stick', '#f2e8f2', 6], ['Hand Lotion', 'bottle', '#f2d8c2', 5],
    ['Pain Reliever', 'bottle_s', '#d82a2a', 6], ['Bandages', 'box_s', '#e8c8a8', 5],
    ['Mint Mouthwash', 'bottle', '#3ab84a', 4], ['Cotton Swabs', 'can_s', '#f2f2f2', 4],
  ]},
  { name: 'Pet Supplies', color: '#8e6e53', products: [
    ['Dry Dog Food', 'bigbag', '#c82a2a', 4], ['Dry Cat Food', 'bag_s', '#8a3ae8', 6],
    ['Wet Cat Food', 'can_s', '#e85a8a', 10], ['Wet Dog Food', 'can', '#a8742a', 8],
    ['Dog Treats', 'pouch', '#e89a2a', 6], ['Cat Litter', 'jug', '#5a8a9a', 3],
    ['Bird Seed', 'bag_s', '#c8a83a', 4], ['Fish Flakes', 'spice', '#3a8ae8', 5],
    ['Chew Toys', 'box_s', '#3ac83a', 5], ['Cat Treats', 'pouch', '#f2c21a', 6],
    ['Puppy Pads', 'pack6', '#8ad8f2', 3], ['Rawhide Bones', 'box_m', '#e8d8b8', 4],
  ]},
  { name: 'Spices', color: '#a04000', products: [
    ['Black Pepper', 'spice', '#2a2a2a', 9], ['Sea Salt', 'can_tall', '#3a6ae8', 8],
    ['Garlic Powder', 'spice', '#f2e8c8', 8], ['Onion Powder', 'spice', '#e8d8a8', 7],
    ['Smoked Paprika', 'spice', '#c8321a', 7], ['Ground Cinnamon', 'spice', '#8a4a1a', 8],
    ['Chili Powder', 'spice', '#a8281a', 7], ['Ground Cumin', 'spice', '#a8742a', 6],
    ['Dried Oregano', 'spice', '#5a7a2a', 6], ['Italian Seasoning', 'spice', '#4a8a3a', 6],
    ['Taco Seasoning', 'box_s', '#e8a01a', 8], ['Red Pepper Flakes', 'spice', '#d8401a', 6],
  ]},
];

// Size of an item as it sits on a shelf: w along the shelf, h up, d into it.
export function footprint(shape) {
  const s = shape.size;
  if (shape.kind === 'box') return { w: s[0], h: s[1], d: s[2] };
  if (shape.kind === 'cyl') return { w: s[0] * 2, h: s[1], d: s[0] * 2 };
  return { w: s[0] * 2, h: s[0] * 2, d: s[0] * 2 };
}

export function buildCatalog() {
  const products = [];
  SECTIONS.forEach((sec, si) => {
    sec.index = si;
    sec.products.forEach(([name, shapeKey, color, count]) => {
      const shape = SHAPES[shapeKey];
      products.push({
        id: products.length, name, section: sec, shapeKey, shape, color,
        count: Math.min(MAX_PER, Math.max(MIN_PER, count)),
        fp: footprint(shape), placed: 0,
      });
    });
  });

  let total = products.reduce((a, p) => a + p.count, 0);
  for (let i = 0; total !== TOTAL_ITEMS && i < 100000; i++) {
    const p = products[(i * 7) % products.length];
    if (total < TOTAL_ITEMS && p.count < MAX_PER) { p.count++; total++; }
    else if (total > TOTAL_ITEMS && p.count > MIN_PER) { p.count--; total--; }
  }

  for (const sec of SECTIONS) sec.list = products.filter(p => p.section === sec);
  return products;
}
