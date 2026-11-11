/* Weight Control Quest — Island Recipe Book (2026-11-11)
 * The computer decides which dishes a group can cook from its 15 pallet foods.
 * Spices, seasonings, water, salt, yeast and baking powder are free on the island.
 *
 * ING:     ingredient key -> [display name, base unit, unit family, synonyms regex, [cal, pro, carb, fat, fib] per base unit, processed?]
 *          processed = may be matched even when a student marked the food "Combination" (bread, cheese, pasta…)
 * RECIPES: [id, name, meal tag, [[key, amount, altKey?, altAmount?], ...]]
 *          key starting with "?" = optional (used only if on the pallet). altKey = "or make it from this".
 * Teacher-approved dishes come from Supabase (wcq_recipes_list) in the same shape.
 */
(function () {
const ING = {
  egg:        ['Eggs', 'egg', 'count', /\beggs?\b/, [72, 6.3, 0.4, 4.8, 0]],
  milk:       ['Milk', 'cup', 'vol', /\bmilk\b/, [150, 8, 12, 8, 0]],
  cream:      ['Cream', 'tbsp', 'vol', /\bcream\b/, [51, 0.4, 0.4, 5.4, 0]],
  butter:     ['Butter', 'tbsp', 'vol', /(?<!peanut |nut |almond )\bbutter\b|\bmargarine\b/, [102, 0.1, 0, 11.5, 0]],
  oil:        ['Oil', 'tbsp', 'vol', /\boil\b|\blard\b|\bshortening\b/, [120, 0, 0, 13.6, 0]],
  flour:      ['Flour', 'cup', 'vol', /\bflour\b|\bflower\b|\bwheat\b/, [455, 13, 95, 1.2, 3.4]],
  sugar:      ['Sugar', 'tbsp', 'vol', /\bsug\w*r\b/, [48, 0, 12.5, 0, 0]],
  honey:      ['Honey / syrup', 'tbsp', 'vol', /\bhoney\b|\bsyrup\b|\bjam\b|\bjelly\b|\bcaramel\b/, [64, 0.1, 17, 0, 0]],
  rice:       ['Rice', 'cup', 'vol', /\brice\b/, [205, 4.3, 45, 0.4, 0.6]],
  oats:       ['Oats', 'cup', 'vol', /\boats?\b|\boatmeal\b/, [166, 6, 28, 3.6, 4]],
  pasta:      ['Pasta / noodles', 'cup', 'vol', /\bpasta\b|\bnoodles?\b|\bspaghetti\b|\bmacaroni\b/, [220, 8, 43, 1.3, 2.5]],
  bread:      ['Bread', 'slice', 'count', /\bbread\b|\bbuns?\b|\btoast\b|\brolls?\b|\bbagels?\b|\bsour ?d\w*gh\b|\bpita\b|\bpeda\b/, [80, 3, 14, 1, 1.5]],
  tortilla:   ['Tortillas', 'tortilla', 'count', /\btort\w*l\w*s?\b|\btaco shells?\b/, [140, 4, 24, 3.5, 1.5]],
  potato:     ['Potatoes', 'potato', 'count', /\bpo\w{0,3}t\w*to\w*|\bspuds?\b|\byams?\b/, [161, 4.3, 37, 0.2, 3.8]],
  chicken:    ['Chicken', 'oz', 'wt', /\bch?i\w*ken\b|\bchick(?!peas?\b)\w*/, [47, 8.8, 0, 1, 0]],
  turkey:     ['Turkey', 'oz', 'wt', /\bturkey\b/, [42, 8, 0, 1, 0]],
  beef:       ['Beef', 'oz', 'wt', /\bbeef\b|\bsteaks?\b|\bhamburgers?\b|\bburgers?\b|\bground meat\b|\belk\b|\bvenison\b|\bbrisket\b|\brib ?eye\b|\bsirloin\b|\btomahawk\b|\bt ?bone\b|\bchuck\b|\bwa(g|y)+u\b|\bangus\b|\bcow\b|\bribs\b|\bmeat\b|\broast\b/, [70, 7, 0, 4.5, 0]],
  pork:       ['Pork / ham / bacon', 'oz', 'wt', /\bpork\b|\bham\b|\bbacon\b|\bsausages?\b|\bpig\b|\bhot ?dogs?\b|\bpepperoni\b/, [58, 7.5, 0, 3, 0]],
  fish:       ['Fish / seafood', 'oz', 'wt', /\bfish\b|\bsa\w*mon\b|\bsamlon\b|\btuna\b|\btilapia\b|\bcod\b|\btrout\b|\bshrimp\b|\bseafood\b|\bcrab\b|\blobster\b|\bhalibut\b/, [40, 7, 0, 1.2, 0]],
  cottage:    ['Cottage cheese', 'cup', 'vol', /\bcottage cheese\b/, [206, 23, 8, 9, 0]],
  cheese:     ['Cheese', 'oz', 'wt', /\bcheese\b|\bcheddar\b|\bmozzarella\b|\bparmesan\b|\bpepper jack\b|\bcolby\b/, [114, 7, 0.4, 9.4, 0]],
  yogurt:     ['Yogurt', 'cup', 'vol', /\by\w*g\w*rt\b|\byog\w*/, [150, 8.5, 11.4, 8, 0]],
  beans:      ['Beans', 'cup', 'vol', /(?<!green |cacao |coffee |cocoa )\bbeans?\b|\blentils?\b|\bchickpeas?\b/, [227, 15, 41, 0.9, 15]],
  pb:         ['Peanut butter', 'tbsp', 'vol', /\bpeanut butter\b|\balmond butter\b|\bnut butter\b/, [95, 3.5, 3.5, 8, 1]],
  peanuts:    ['Peanuts', 'oz', 'wt', /\bpeanuts?\b/, [166, 7.3, 6, 14, 2.4]],
  nuts:       ['Nuts', 'oz', 'wt', /\balmonds?\b|\bwalnuts?\b|\bcashews?\b|\bpecans?\b|\bpistachios?\b|\bnuts\b/, [164, 6, 6, 14, 3.5]],
  tomato:     ['Tomatoes', 'tomato', 'count', /\btomato\w*|\bmarinara\b|\bsalsa\b/, [22, 1.1, 4.8, 0.2, 1.5]],
  onion:      ['Onions', 'onion', 'count', /\bonions?\b/, [44, 1.2, 10, 0.1, 1.9]],
  lettuce:    ['Lettuce', 'cup', 'vol', /\blet+uce\b|\bromaine\b|\bsalad\b|\bgreens\b/, [5, 0.4, 1, 0.1, 0.5]],
  spinach:    ['Spinach', 'cup', 'vol', /\bspin\w*|\bkale\b/, [41, 5.3, 6.8, 0.5, 4.3]],
  broccoli:   ['Broccoli', 'cup', 'vol', /\bbro\w*c\w*l\w*|\bcauliflower\b/, [31, 2.6, 6, 0.3, 2.4]],
  carrot:     ['Carrots', 'carrot', 'count', /\bcar+ots?\b/, [25, 0.6, 6, 0.1, 1.7]],
  popcorn:    ['Popcorn', 'cup', 'vol', /\bpop ?corn\b/, [31, 1, 6, 0.4, 1.2]],
  corn:       ['Corn', 'cup', 'vol', /\bcorn\b/, [143, 5, 31, 2, 3.6]],
  squash:     ['Squash', 'cup', 'vol', /\bsquash\b|\bzucchini\b|\bpumpkin\b/, [82, 1.8, 21.5, 0.2, 6.6]],
  greenbeans: ['Green beans', 'cup', 'vol', /\bgreen beans?\b/, [44, 2.4, 10, 0.4, 4]],
  peas:       ['Peas', 'cup', 'vol', /\bpeas\b/, [134, 8.6, 25, 0.4, 8.8]],
  pepper:     ['Bell peppers', 'pepper', 'count', /\bbell pep+ers?\b|\bgreen pep+ers?\b|\bred pep+ers?\b|(?<!dr )\bpep+ers\b|\bjalap\w*/, [30, 1, 7, 0.3, 2.5]],
  cabbage:    ['Cabbage', 'cup', 'vol', /\bcabbage\b/, [22, 1.1, 5, 0.1, 2.2]],
  cucumber:   ['Cucumber', 'cucumber', 'count', /\bcuc\w*m\w*rs?\b|\bpickles?\b/, [45, 2, 11, 0.3, 1.5]],
  mushroom:   ['Mushrooms', 'cup', 'vol', /\bmushrooms?\b/, [15, 2.2, 2.3, 0.2, 0.7]],
  veg:        ['Mixed vegetables', 'cup', 'vol', /\bveg\w*bles?\b|\bmixed veg\w*|\basparagus\b|\bjicama\b|\bbeets?\b|\bcelery\b|\bolives?\b/, [60, 2.6, 12, 0.3, 4]],
  apple:      ['Apples', 'apple', 'count', /(?<!pine)\bapples?\b/, [95, 0.5, 25, 0.3, 4.4]],
  banana:     ['Bananas', 'banana', 'count', /\bban+an+as?\b/, [105, 1.3, 27, 0.4, 3.1]],
  berries:    ['Berries', 'cup', 'vol', /berr|barri/, [85, 1.1, 21, 0.5, 3.6]],
  orange:     ['Oranges', 'orange', 'count', /\boranges?\b|\bclementines?\b|\btangerines?\b|\bmandarins?\b|\bcuties\b/, [62, 1.2, 15, 0.2, 3.1]],
  grapes:     ['Grapes / raisins', 'cup', 'vol', /\bgrapes?\b|\braisins?\b|\bdried fruits?\b/, [104, 1.1, 27, 0.2, 1.4]],
  pineapple:  ['Pineapple', 'cup', 'vol', /\bpin\w*apple\b/, [82, 0.9, 22, 0.2, 2.3]],
  melon:      ['Melon', 'cup', 'vol', /melon|\bwaterlemon\b|\bcantal\w*|\bhoney ?dew\b/, [46, 0.9, 11.5, 0.2, 0.6]],
  mango:      ['Mango', 'mango', 'count', /\bmang(o|os|oes)\b/, [200, 2.8, 50, 1.3, 5.4]],
  kiwi:       ['Kiwi', 'kiwi', 'count', /\bk(i|e)wis?\b/, [42, 0.8, 10, 0.4, 2.1]],
  peach:      ['Peaches / plums', 'peach', 'count', /\bpeach(es)?\b|\bplums?\b|\bnectarines?\b|\bapricots?\b/, [59, 1.4, 14, 0.4, 2.3]],
  pear:       ['Pears', 'pear', 'count', /\bpears?\b/, [101, 0.6, 27, 0.2, 5.5]],
  cherries:   ['Cherries', 'cup', 'vol', /\bcherr\w*/, [97, 1.6, 25, 0.3, 3.2]],
  coconut:    ['Coconut', 'cup', 'vol', /\bcoconuts?\b/, [283, 2.7, 12, 27, 7.2]],
  avocado:    ['Avocado', 'avocado', 'count', /\ba(v|c)\w*c\w*d\w*|\bguacamole\b/, [240, 3, 12, 22, 10]],
  chocolate:  ['Chocolate', 'oz', 'wt', /\bchoc\w*|\bcocoa\b|\bcacao\b|\bcoco\b/, [155, 2, 17, 9, 2]],
  quinoa:     ['Quinoa', 'cup', 'vol', /\bquinoa\b/, [222, 8, 39, 3.6, 5]]
};
// Order matters: longer / more specific names are checked first.
const MATCH_ORDER = ['pb', 'cottage', 'greenbeans', 'popcorn', 'melon', 'pineapple', 'chocolate', 'coconut', 'oil', 'egg', 'bread', 'tortilla',
  'cream', 'milk', 'butter', 'pepper', 'flour', 'sugar', 'honey', 'rice', 'oats', 'pasta', 'potato', 'chicken', 'turkey', 'fish', 'pork', 'beef',
  'cheese', 'yogurt', 'beans', 'peanuts', 'nuts', 'tomato', 'onion', 'spinach', 'broccoli', 'carrot', 'corn', 'squash', 'peas', 'cabbage',
  'cucumber', 'mushroom', 'apple', 'banana', 'berries', 'orange', 'grapes', 'mango', 'kiwi', 'peach', 'pear', 'cherries', 'avocado', 'quinoa',
  'lettuce', 'veg'];
// Whole dishes and brand-name snacks are eaten as plain foods, never used as ingredients.
const DISH_WORDS = /\b(pizza|burrit\w*|burit\w*|sandwh?ich\w*|soup|bisque|stew|tacos|lasagna|lasnaga|enchilada\w*|quesadilla\w*|alfredo|mac (and|n) cheese|bowl|jerky|chips|cookies?|brownies?|ice cre\w*|sauce|sushi|nuggets|hot chi\w*|tiramis\w*|starbursts?|gushers|takis|monster|dr pepper|pieces|goldfish|protein powder|granola|gronla|pretzels?|rice ?cakes?|ranch|dressing|cereal|crackers?|fruit salad|seasonings?|spices?|salt|yeast|water|garlic|herbs|mustard|musterd|candy|cake|pie|fries|wings)\b/;
const BURGER = /\b(cheese ?burgers?|hamburgers?|burgers?)\b/;

// Homemade swaps: bread, tortillas and pasta can be made from flour (yeast and salt are free).
const BREAD = ['bread', 2, 'flour', 0.35], TORT = ['tortilla', 1, 'flour', 0.3], TORT2 = ['tortilla', 2, 'flour', 0.6];
const PASTA = ['pasta', 1.5, 'flour', 0.6], FAT1 = ['butter', 1, 'oil', 1], OIL1 = ['oil', 1, 'butter', 1], FAT_H = ['oil', 0.5, 'butter', 0.5];

const RECIPES = [
  // breakfast
  ['pancakes', 'Pancakes', 'B', [['flour', 0.5], ['egg', 1], ['milk', 0.5], OIL1, ['?sugar', 1]]],
  ['waffles', 'Waffles', 'B', [['flour', 0.5], ['egg', 1], ['milk', 0.5], ['butter', 2, 'oil', 2], ['?sugar', 1]]],
  ['crepes', 'Crepes', 'B', [['flour', 0.25], ['egg', 1], ['milk', 0.5], FAT1]],
  ['french-toast', 'French Toast', 'B', [BREAD, ['egg', 1], ['milk', 0.25], FAT1]],
  ['scrambled-eggs', 'Scrambled Eggs', 'B', [['egg', 3], FAT1]],
  ['cheesy-eggs', 'Cheesy Scrambled Eggs', 'B', [['egg', 3], ['cheese', 1], FAT1]],
  ['fried-eggs', 'Fried Eggs', 'B', [['egg', 2], FAT_H]],
  ['boiled-eggs', 'Hard-Boiled Eggs', 'S', [['egg', 2]]],
  ['veggie-omelet', 'Veggie Omelet', 'B', [['egg', 3], ['pepper', 0.5], ['?onion', 0.25], FAT1]],
  ['spinach-omelet', 'Spinach Omelet', 'B', [['egg', 3], ['spinach', 0.5], ['?cheese', 1], FAT1]],
  ['ham-cheese-omelet', 'Ham & Cheese Omelet', 'B', [['egg', 3], ['pork', 2], ['cheese', 1], FAT1]],
  ['eggs-bacon', 'Eggs & Bacon', 'B', [['egg', 2], ['pork', 2]]],
  ['breakfast-burrito', 'Breakfast Burrito', 'B', [TORT, ['egg', 2], ['pork', 2], ['?cheese', 1]]],
  ['hash-browns', 'Hash Browns', 'B', [['potato', 1], OIL1, ['?onion', 0.25]]],
  ['steak-eggs', 'Steak & Eggs', 'B', [['beef', 4], ['egg', 2], FAT_H]],
  ['egg-sandwich', 'Egg Sandwich', 'B', [BREAD, ['egg', 2], ['?cheese', 1]]],
  ['oatmeal', 'Oatmeal', 'B', [['oats', 1], ['milk', 0.5], ['?sugar', 1]]],
  ['banana-oatmeal', 'Banana Oatmeal', 'B', [['oats', 1], ['banana', 1], ['?milk', 0.5]]],
  ['apple-oatmeal', 'Apple Cinnamon Oatmeal', 'B', [['oats', 1], ['apple', 0.5], ['?sugar', 1]]],
  ['pb-oatmeal', 'Peanut Butter Oatmeal', 'B', [['oats', 1], ['pb', 1]]],
  ['berry-oatmeal', 'Berry Oatmeal', 'B', [['oats', 1], ['berries', 0.5], ['?milk', 0.5]]],
  ['parfait', 'Yogurt Parfait', 'B', [['yogurt', 1], ['berries', 0.5], ['?honey', 1], ['?oats', 0.25]]],
  ['yogurt-banana', 'Yogurt & Banana', 'S', [['yogurt', 1], ['banana', 1]]],
  ['butter-toast', 'Buttered Toast', 'B', [BREAD, FAT1]],
  ['pb-toast', 'Peanut Butter Toast', 'B', [BREAD, ['pb', 2]]],
  ['avocado-toast', 'Avocado Toast', 'B', [BREAD, ['avocado', 0.5]]],
  ['honey-toast', 'Honey Toast', 'B', [BREAD, ['honey', 1], ['?butter', 1]]],
  ['biscuits', 'Biscuits', 'B', [['flour', 0.5], ['butter', 2, 'oil', 2], ['milk', 0.25]]],
  ['biscuits-gravy', 'Biscuits & Gravy', 'B', [['flour', 0.6], ['butter', 2, 'oil', 2], ['milk', 0.75], ['pork', 2]]],
  ['muffins', 'Muffins', 'B', [['flour', 0.5], ['egg', 0.5], ['milk', 0.25], ['sugar', 2], OIL1]],
  ['blueberry-muffins', 'Berry Muffins', 'B', [['flour', 0.5], ['berries', 0.25], ['egg', 0.5], ['milk', 0.25], ['sugar', 2], OIL1]],
  ['banana-bread', 'Banana Bread', 'S', [['flour', 0.5], ['banana', 1], ['egg', 0.5], ['sugar', 2], ['butter', 2, 'oil', 2]]],
  ['banana-smoothie', 'Banana Smoothie', 'S', [['banana', 1], ['milk', 1], ['?pb', 1]]],
  ['berry-smoothie', 'Berry Smoothie', 'S', [['berries', 1], ['yogurt', 0.5], ['?banana', 0.5]]],
  ['rice-pudding', 'Rice Pudding', 'S', [['rice', 1], ['milk', 1], ['sugar', 2]]],
  ['sweet-rice', 'Sweet Rice & Milk', 'B', [['rice', 1], ['milk', 0.5], ['?sugar', 1]]],
  // rice, grains
  ['egg-fried-rice', 'Egg Fried Rice', 'L', [['rice', 1.5], ['egg', 2], OIL1, ['?onion', 0.25], ['?peas', 0.25]]],
  ['chicken-fried-rice', 'Chicken Fried Rice', 'D', [['rice', 1.5], ['chicken', 3], ['egg', 1], OIL1, ['?peas', 0.25], ['?carrot', 0.5]]],
  ['beef-fried-rice', 'Beef Fried Rice', 'D', [['rice', 1.5], ['beef', 3], ['egg', 1], OIL1, ['?onion', 0.25]]],
  ['pork-fried-rice', 'Pork Fried Rice', 'D', [['rice', 1.5], ['pork', 3], ['egg', 1], OIL1, ['?onion', 0.25]]],
  ['rice-beans', 'Rice & Beans', 'L', [['rice', 1], ['beans', 1]]],
  ['chicken-rice', 'Chicken & Rice', 'D', [['chicken', 4], ['rice', 1], FAT_H]],
  ['beef-rice-bowl', 'Beef Rice Bowl', 'D', [['beef', 4], ['rice', 1], ['?onion', 0.25], FAT_H]],
  ['pork-rice-bowl', 'Pork & Rice Bowl', 'D', [['pork', 4], ['rice', 1], FAT_H]],
  ['teriyaki-chicken', 'Teriyaki Chicken & Rice', 'D', [['chicken', 4], ['sugar', 1, 'honey', 1], ['rice', 1]]],
  ['chicken-stirfry', 'Chicken Stir-Fry', 'D', [['chicken', 4], ['broccoli', 1], ['?carrot', 1], ['?pepper', 0.5], OIL1, ['?rice', 1]]],
  ['beef-broccoli', 'Beef & Broccoli', 'D', [['beef', 4], ['broccoli', 1], OIL1, ['?rice', 1]]],
  ['veggie-stirfry', 'Veggie Stir-Fry', 'L', [['broccoli', 1], ['carrot', 1], ['pepper', 0.5], OIL1, ['?rice', 1]]],
  ['burrito-bowl', 'Burrito Bowl', 'L', [['rice', 1], ['beans', 0.5], ['chicken', 3, 'beef', 3], ['?corn', 0.5], ['?cheese', 1]]],
  ['quinoa-bowl', 'Quinoa Bowl', 'L', [['quinoa', 1], ['beans', 0.5], ['?corn', 0.5], ['?avocado', 0.25]]],
  ['stuffed-peppers', 'Stuffed Peppers', 'D', [['pepper', 1], ['beef', 3], ['rice', 0.5], ['?tomato', 0.5]]],
  ['spanish-rice', 'Spanish Rice', 'L', [['rice', 1], ['tomato', 1], OIL1, ['?onion', 0.25]]],
  ['risotto', 'Squash Risotto', 'D', [['rice', 1], ['squash', 0.5], ['butter', 1, 'oil', 1], ['?cheese', 0.5]]],
  // chicken
  ['grilled-chicken', 'Grilled Chicken', 'D', [['chicken', 4], FAT_H]],
  ['fried-chicken', 'Fried Chicken', 'D', [['chicken', 5], ['flour', 0.25], ['?egg', 0.5], ['oil', 2]]],
  ['chicken-nuggets', 'Chicken Nuggets', 'L', [['chicken', 4], ['flour', 0.25, 'bread', 1], ['egg', 0.5], ['oil', 2]]],
  ['chicken-noodle-soup', 'Chicken Noodle Soup', 'L', [['chicken', 3], ['pasta', 1, 'flour', 0.4], ['?carrot', 1], ['?onion', 0.25]]],
  ['chicken-rice-soup', 'Chicken & Rice Soup', 'L', [['chicken', 3], ['rice', 0.75], ['?carrot', 1], ['?onion', 0.25]]],
  ['roast-chicken-potatoes', 'Roast Chicken & Potatoes', 'D', [['chicken', 4], ['potato', 1], OIL1]],
  ['chicken-salad', 'Chicken Salad', 'L', [['lettuce', 2, 'spinach', 1.5], ['chicken', 3], ['?tomato', 0.5], ['?cucumber', 0.5], OIL1]],
  ['chicken-quesadilla', 'Chicken Quesadilla', 'L', [TORT2, ['chicken', 3], ['cheese', 2]]],
  ['chicken-tacos', 'Chicken Tacos', 'L', [TORT2, ['chicken', 3], ['?lettuce', 0.5], ['?cheese', 1], ['?tomato', 0.5]]],
  ['chicken-fajitas', 'Chicken Fajitas', 'D', [TORT2, ['chicken', 4], ['pepper', 1], ['?onion', 0.5], OIL1]],
  ['chicken-enchiladas', 'Chicken Enchiladas', 'D', [TORT2, ['chicken', 3], ['cheese', 2], ['tomato', 1]]],
  ['chicken-sandwich', 'Chicken Sandwich', 'L', [BREAD, ['chicken', 4], ['?lettuce', 0.25], ['?tomato', 0.25]]],
  ['chicken-alfredo', 'Chicken Alfredo', 'D', [PASTA, ['chicken', 3], ['milk', 0.5], ['butter', 1, 'oil', 1], ['?cheese', 1]]],
  ['chicken-corn-chowder', 'Chicken Corn Chowder', 'D', [['chicken', 3], ['corn', 1], ['milk', 1], ['?potato', 1]]],
  ['chicken-spinach', 'Chicken & Spinach Skillet', 'D', [['chicken', 4], ['spinach', 1], OIL1]],
  ['chicken-squash', 'Chicken & Roasted Squash', 'D', [['chicken', 4], ['squash', 1], OIL1]],
  ['chicken-corn', 'Chicken & Buttered Corn', 'D', [['chicken', 4], ['corn', 1], FAT1]],
  ['turkey-sandwich', 'Turkey Sandwich', 'L', [BREAD, ['turkey', 3], ['?lettuce', 0.25], ['?cheese', 1]]],
  ['turkey-dinner', 'Turkey Dinner', 'D', [['turkey', 4], ['potato', 1], ['?greenbeans', 1], ['?butter', 1]]],
  // beef
  ['hamburger-patty', 'Hamburger Patty', 'D', [['beef', 4]]],
  ['hamburger', 'Hamburger', 'L', [BREAD, ['beef', 4], ['?lettuce', 0.25], ['?tomato', 0.25], ['?onion', 0.1]]],
  ['cheeseburger', 'Cheeseburger', 'L', [BREAD, ['beef', 4], ['cheese', 1]]],
  ['steak-potato', 'Steak & Baked Potato', 'D', [['beef', 5], ['potato', 1], ['?butter', 1]]],
  ['steak-corn', 'Steak & Corn', 'D', [['beef', 5], ['corn', 1], ['?butter', 1]]],
  ['beef-squash', 'Beef & Squash Skillet', 'D', [['beef', 4], ['squash', 1], ['?onion', 0.25], FAT_H]],
  ['beef-tacos', 'Beef Tacos', 'D', [TORT2, ['beef', 3], ['?lettuce', 0.5], ['?cheese', 1], ['?tomato', 0.5]]],
  ['beef-burrito', 'Beef Burrito', 'L', [TORT, ['beef', 3], ['?beans', 0.5], ['?rice', 0.5], ['?cheese', 1]]],
  ['beef-fajitas', 'Beef Fajitas', 'D', [TORT2, ['beef', 4], ['pepper', 1], ['?onion', 0.5], OIL1]],
  ['chili', 'Chili', 'D', [['beef', 3], ['beans', 1], ['tomato', 1], ['?onion', 0.25]]],
  ['beef-stew', 'Beef Stew', 'D', [['beef', 4], ['potato', 1], ['carrot', 1], ['?onion', 0.5]]],
  ['meatballs', 'Meatballs', 'D', [['beef', 4], ['egg', 0.25], ['bread', 1, 'flour', 0.1]]],
  ['meatloaf', 'Meatloaf', 'D', [['beef', 4], ['egg', 0.25], ['bread', 1, 'flour', 0.1], ['?tomato', 0.25]]],
  ['shepherds-pie', "Shepherd's Pie", 'D', [['beef', 3], ['potato', 1], ['?carrot', 0.5], ['?peas', 0.5], ['?butter', 1]]],
  ['spaghetti-meat', 'Spaghetti with Meat Sauce', 'D', [PASTA, ['beef', 3], ['tomato', 1], ['?onion', 0.25]]],
  ['lasagna', 'Lasagna', 'D', [['pasta', 1, 'flour', 0.4], ['beef', 3], ['cheese', 2], ['tomato', 1]]],
  ['beef-noodles', 'Beef & Noodles', 'D', [PASTA, ['beef', 3], ['?butter', 1], ['?mushroom', 0.5]]],
  ['sloppy-joes', 'Sloppy Joes', 'L', [BREAD, ['beef', 3], ['tomato', 1], ['?sugar', 1]]],
  ['beef-veggie-soup', 'Beef Vegetable Soup', 'L', [['beef', 3], ['potato', 1], ['carrot', 1], ['?tomato', 1], ['?corn', 0.5]]],
  // pork
  ['pork-chops', 'Pork Chops', 'D', [['pork', 5], FAT_H]],
  ['pork-chops-apples', 'Pork Chops & Apples', 'D', [['pork', 5], ['apple', 1], ['?sugar', 1]]],
  ['pulled-pork', 'Pulled Pork Sandwich', 'L', [BREAD, ['pork', 4], ['?sugar', 1, 'honey', 1]]],
  ['pork-tacos', 'Pork Carnitas Tacos', 'D', [TORT2, ['pork', 3], ['?onion', 0.25]]],
  ['ham-sandwich', 'Ham Sandwich', 'L', [BREAD, ['pork', 3], ['?lettuce', 0.25]]],
  ['ham-cheese', 'Ham & Cheese Sandwich', 'L', [BREAD, ['pork', 3], ['cheese', 1]]],
  ['blt', 'BLT', 'L', [BREAD, ['pork', 2], ['lettuce', 0.5], ['tomato', 0.5]]],
  ['pork-potatoes', 'Pork & Potatoes', 'D', [['pork', 4], ['potato', 1], FAT_H]],
  ['pork-corn', 'Pork & Corn', 'D', [['pork', 4], ['corn', 1], ['?butter', 1]]],
  ['pork-spinach', 'Pork & Spinach Skillet', 'D', [['pork', 4], ['spinach', 1], FAT_H]],
  ['green-beans-bacon', 'Green Beans with Bacon', 'D', [['greenbeans', 1], ['pork', 1]]],
  ['bean-soup', 'Ham & Bean Soup', 'L', [['beans', 1.5], ['pork', 1], ['?onion', 0.25], ['?carrot', 0.5]]],
  // fish
  ['baked-fish', 'Baked Fish', 'D', [['fish', 5], FAT1]],
  ['fish-chips', 'Fish & Chips', 'D', [['fish', 5], ['flour', 0.25], ['potato', 1], ['oil', 2]]],
  ['fish-rice', 'Fish & Rice', 'D', [['fish', 5], ['rice', 1], FAT_H]],
  ['fish-tacos', 'Fish Tacos', 'D', [TORT2, ['fish', 4], ['?cabbage', 0.5]]],
  ['fish-sandwich', 'Fish Sandwich', 'L', [BREAD, ['fish', 3], ['?lettuce', 0.25]]],
  // pasta, sandwiches, pizza
  ['homemade-noodles', 'Homemade Noodles', 'D', [['flour', 0.6], ['egg', 1], ['?butter', 1]]],
  ['spaghetti-marinara', 'Spaghetti Marinara', 'D', [PASTA, ['tomato', 1.5], OIL1]],
  ['mac-cheese', 'Mac & Cheese', 'L', [PASTA, ['cheese', 2], ['milk', 0.25], ['?butter', 1]]],
  ['buttered-noodles', 'Buttered Noodles', 'L', [PASTA, FAT1]],
  ['pasta-salad', 'Pasta Salad', 'L', [['pasta', 1, 'flour', 0.4], ['tomato', 0.5], ['?cucumber', 0.5], OIL1]],
  ['homemade-pizza', 'Homemade Cheese Pizza', 'D', [['flour', 0.5], ['cheese', 2], ['tomato', 1], ['?oil', 1]]],
  ['meat-pizza', 'Homemade Meat Pizza', 'D', [['flour', 0.5], ['cheese', 2], ['tomato', 1], ['pork', 1.5, 'beef', 1.5]]],
  ['grilled-cheese', 'Grilled Cheese', 'L', [BREAD, ['cheese', 2], ['?butter', 1]]],
  ['cheese-quesadilla', 'Cheese Quesadilla', 'L', [TORT2, ['cheese', 2]]],
  ['bean-burrito', 'Bean Burrito', 'L', [TORT, ['beans', 0.75], ['?cheese', 1]]],
  ['pb-banana-sandwich', 'PB & Banana Sandwich', 'L', [BREAD, ['pb', 2], ['banana', 1]]],
  ['pb-honey-sandwich', 'PB & Honey (or Jelly) Sandwich', 'L', [BREAD, ['pb', 2], ['honey', 1]]],
  ['homemade-bread', 'Homemade Bread', 'S', [['flour', 0.5], ['?sugar', 0.5], ['?oil', 0.5]]],
  ['flatbread', 'Pan-Fried Flatbread', 'S', [['flour', 0.4], OIL1]],
  ['homemade-tortillas', 'Homemade Tortillas', 'S', [['flour', 0.6], ['oil', 1, 'butter', 1]]],
  // potatoes & sides
  ['mashed-potatoes', 'Mashed Potatoes', 'D', [['potato', 1], ['?butter', 1], ['?milk', 0.25]]],
  ['baked-potato', 'Baked Potato', 'D', [['potato', 1], ['?butter', 1]]],
  ['loaded-potato', 'Loaded Baked Potato', 'D', [['potato', 1], ['cheese', 1], ['pork', 1], ['?butter', 1]]],
  ['french-fries', 'French Fries', 'S', [['potato', 1], ['oil', 2]]],
  ['potato-soup', 'Potato Soup', 'L', [['potato', 1.5], ['milk', 1], ['?butter', 1], ['?onion', 0.25]]],
  ['potato-salad', 'Potato Salad', 'L', [['potato', 1], ['egg', 1], ['?onion', 0.25]]],
  ['garden-salad', 'Garden Salad', 'L', [['lettuce', 2], ['?tomato', 0.5], ['?carrot', 0.5], ['?cucumber', 0.5], ['?oil', 1]]],
  ['spinach-salad', 'Spinach Salad', 'L', [['spinach', 1.5], ['?egg', 1], ['?tomato', 0.5], ['?oil', 1]]],
  ['coleslaw', 'Coleslaw', 'S', [['cabbage', 1.5], ['?carrot', 0.5], ['?sugar', 1], ['?oil', 1]]],
  ['roasted-veggies', 'Roasted Vegetables', 'D', [['carrot', 1, 'squash', 1], ['?broccoli', 1], ['?squash', 1], OIL1]],
  ['broccoli-cheese', 'Broccoli & Cheese', 'D', [['broccoli', 1], ['cheese', 1]]],
  ['roasted-squash', 'Roasted Squash', 'D', [['squash', 1], ['?butter', 1], ['?sugar', 1]]],
  ['squash-soup', 'Squash Soup', 'L', [['squash', 1.5], ['?onion', 0.25], ['?milk', 0.5]]],
  ['creamed-spinach', 'Creamed Spinach', 'D', [['spinach', 1], ['milk', 0.25], FAT1]],
  ['sauteed-spinach', 'Sautéed Spinach', 'D', [['spinach', 1], FAT_H]],
  ['buttered-corn', 'Buttered Corn', 'D', [['corn', 1], ['?butter', 1]]],
  ['creamed-corn', 'Creamed Corn', 'D', [['corn', 1], ['milk', 0.25], ['?butter', 1], ['?sugar', 0.5]]],
  ['corn-chowder', 'Corn Chowder', 'L', [['corn', 1], ['milk', 1], ['?potato', 1], ['?butter', 1]]],
  ['corn-fritters', 'Corn Fritters', 'S', [['corn', 0.5], ['flour', 0.25], ['egg', 0.5], ['oil', 1]]],
  ['veggie-soup', 'Vegetable Soup', 'L', [['carrot', 1], ['potato', 1], ['tomato', 1], ['?onion', 0.5], ['?corn', 0.5]]],
  ['tomato-soup', 'Tomato Soup', 'L', [['tomato', 2], ['?milk', 0.5], ['?butter', 1]]],
  ['green-bean-casserole', 'Green Bean Casserole', 'D', [['greenbeans', 1], ['mushroom', 0.5], ['milk', 0.25], ['?onion', 0.25]]],
  ['peas-carrots', 'Peas & Carrots', 'D', [['peas', 0.5], ['carrot', 1], ['?butter', 1]]],
  ['refried-beans', 'Refried Beans', 'L', [['beans', 1], OIL1]],
  ['guacamole', 'Guacamole', 'S', [['avocado', 1], ['?tomato', 0.25], ['?onion', 0.25]]],
  ['salsa', 'Fresh Salsa', 'S', [['tomato', 1], ['?onion', 0.25], ['?pepper', 0.25]]],
  // snacks & desserts
  ['apple-pb', 'Apple Slices & Peanut Butter', 'S', [['apple', 1], ['pb', 2]]],
  ['banana-pb', 'Banana & Peanut Butter', 'S', [['banana', 1], ['pb', 2]]],
  ['cheese-apple', 'Cheese & Apple Slices', 'S', [['cheese', 1], ['apple', 1]]],
  ['trail-mix', 'Trail Mix', 'S', [['peanuts', 1, 'nuts', 1], ['?chocolate', 0.5], ['?grapes', 0.25]]],
  ['honey-peanuts', 'Honey-Roasted Peanuts', 'S', [['peanuts', 1], ['honey', 1, 'sugar', 1]]],
  ['peanut-brittle', 'Peanut Brittle', 'S', [['peanuts', 1], ['sugar', 3], ['?butter', 1]]],
  ['fruit-salad', 'Fruit Salad', 'S', [['apple', 0.5, 'orange', 0.5], ['banana', 0.5, 'berries', 0.5], ['?grapes', 0.5], ['?pineapple', 0.5]]],
  ['baked-apples', 'Baked Apples', 'S', [['apple', 1], ['?butter', 1], ['?sugar', 1]]],
  ['applesauce', 'Applesauce', 'S', [['apple', 1.5], ['?sugar', 1]]],
  ['apple-pie', 'Apple Pie', 'S', [['apple', 1], ['flour', 0.25], ['butter', 2, 'oil', 2], ['sugar', 2]]],
  ['apple-crisp', 'Apple Crisp', 'S', [['apple', 1], ['oats', 0.5, 'flour', 0.15], ['butter', 1, 'oil', 1], ['sugar', 2]]],
  ['berry-cobbler', 'Berry Cobbler', 'S', [['berries', 1], ['flour', 0.25], ['butter', 2, 'oil', 2], ['sugar', 2]]],
  ['pumpkin-pie', 'Squash (Pumpkin) Pie', 'S', [['squash', 0.5], ['egg', 0.5], ['milk', 0.25], ['sugar', 3], ['flour', 0.25], ['butter', 2, 'oil', 2]]],
  ['chocolate-milk', 'Chocolate Milk', 'S', [['milk', 1], ['chocolate', 0.5], ['?sugar', 1]]],
  ['hot-chocolate', 'Hot Chocolate', 'S', [['milk', 1], ['chocolate', 1], ['?sugar', 1]]],
  ['sugar-cookies', 'Sugar Cookies', 'S', [['flour', 0.25], ['butter', 2, 'oil', 2], ['sugar', 2], ['?egg', 0.25]]],
  ['choc-chip-cookies', 'Chocolate Chip Cookies', 'S', [['flour', 0.25], ['butter', 2, 'oil', 2], ['sugar', 2], ['chocolate', 0.5], ['?egg', 0.25]]],
  ['pb-cookies', 'Peanut Butter Cookies', 'S', [['pb', 2], ['sugar', 2], ['egg', 0.25]]],
  ['oatmeal-cookies', 'Oatmeal Cookies', 'S', [['oats', 0.5], ['flour', 0.2], ['sugar', 2], ['butter', 2, 'oil', 2]]],
  ['brownies', 'Brownies', 'S', [['chocolate', 1], ['flour', 0.15], ['sugar', 3], ['egg', 0.5], ['butter', 2, 'oil', 2]]],
  ['vanilla-cake', 'Vanilla Cake', 'S', [['flour', 0.25], ['sugar', 3], ['egg', 0.5], ['butter', 2, 'oil', 2], ['?milk', 0.25]]],
  ['chocolate-cake', 'Chocolate Cake', 'S', [['flour', 0.25], ['chocolate', 0.5], ['sugar', 3], ['egg', 0.5], ['oil', 1, 'butter', 1]]],
  ['vanilla-pudding', 'Vanilla Pudding', 'S', [['milk', 1], ['sugar', 2], ['egg', 0.5]]],
  ['chocolate-pudding', 'Chocolate Pudding', 'S', [['milk', 1], ['chocolate', 1], ['sugar', 2]]],
  ['ice-cream', 'Homemade Ice Cream', 'S', [['milk', 1], ['sugar', 3], ['?egg', 0.5], ['?berries', 0.25]]],
  ['strawberry-shortcake', 'Berry Shortcake', 'S', [['flour', 0.25], ['berries', 0.75], ['sugar', 2], ['butter', 1, 'oil', 1]]],
  ['donuts', 'Homemade Donuts', 'S', [['flour', 0.4], ['sugar', 2], ['?egg', 0.25], ['?milk', 0.25], ['oil', 2]]],
  ['cinnamon-sugar-tortilla', 'Cinnamon-Sugar Crisps', 'S', [TORT, ['sugar', 1], ['oil', 1, 'butter', 1]]],

  // ── added 2026-11-11 from the foods students actually picked ──
  // breakfast
  ['banana-pancakes', 'Banana Pancakes', 'B', [['banana', 1], ['egg', 2], ['?oats', 0.25]]],
  ['oat-pancakes', 'Oat Pancakes', 'B', [['oats', 0.75], ['egg', 1], ['milk', 0.25, 'yogurt', 0.25], ['?banana', 0.5]]],
  ['berry-pancakes', 'Berry Pancakes', 'B', [['flour', 0.5], ['egg', 1], ['milk', 0.5], ['berries', 0.5], OIL1]],
  ['overnight-oats', 'Overnight Oats', 'B', [['oats', 0.75], ['milk', 0.75, 'yogurt', 0.5], ['?berries', 0.5], ['?banana', 0.5], ['?honey', 1]]],
  ['granola', 'Homemade Granola', 'B', [['oats', 0.75], ['honey', 1, 'sugar', 1], ['oil', 1, 'butter', 1], ['?nuts', 0.5, 'peanuts', 0.5, 'coconut', 0.25]]],
  ['granola-yogurt', 'Granola & Yogurt', 'B', [['yogurt', 1], ['oats', 0.5], ['honey', 1, 'sugar', 1], ['?berries', 0.5]]],
  ['energy-bites', 'No-Bake Energy Bites', 'S', [['oats', 0.5], ['pb', 2], ['honey', 1, 'chocolate', 0.5]]],
  ['avocado-egg-toast', 'Avocado Egg Toast', 'B', [BREAD, ['avocado', 0.5], ['egg', 1]]],
  ['breakfast-hash', 'Breakfast Hash', 'B', [['potato', 1], ['egg', 2], ['pork', 2, 'beef', 2], OIL1, ['?pepper', 0.25], ['?onion', 0.25]]],
  ['potato-egg-skillet', 'Potato & Egg Skillet', 'B', [['potato', 1], ['egg', 2], OIL1, ['?cheese', 1]]],
  ['huevos', 'Eggs & Beans (Huevos)', 'B', [['egg', 2], ['beans', 0.5], ['?tortilla', 1], ['?cheese', 1], ['?tomato', 0.25]]],
  ['bacon-egg-sandwich', 'Bacon, Egg & Cheese Sandwich', 'B', [BREAD, ['egg', 1], ['pork', 1.5], ['cheese', 1]]],
  ['cottage-fruit', 'Cottage Cheese & Fruit', 'B', [['cottage', 1], ['berries', 0.5, 'peach', 1, 'pineapple', 0.5, 'banana', 1, 'mango', 0.5]]],
  ['orange-juice', 'Fresh Orange Juice', 'B', [['orange', 3]]],
  ['strawberry-banana-smoothie', 'Strawberry-Banana Smoothie', 'S', [['berries', 0.75], ['banana', 1], ['?milk', 0.5, 'yogurt', 0.5]]],
  ['mango-smoothie', 'Mango Smoothie', 'S', [['mango', 0.5], ['milk', 0.75, 'yogurt', 0.5], ['?banana', 0.5]]],
  ['tropical-smoothie', 'Tropical Smoothie', 'S', [['pineapple', 0.75, 'mango', 0.5], ['banana', 1, 'coconut', 0.25, 'orange', 1], ['?yogurt', 0.5]]],
  ['green-smoothie', 'Green Smoothie', 'S', [['spinach', 0.5], ['banana', 1, 'mango', 0.5, 'pineapple', 0.75], ['?milk', 0.5, 'yogurt', 0.5]]],
  ['pb-banana-smoothie', 'Peanut Butter Banana Shake', 'S', [['banana', 1], ['pb', 1], ['milk', 1]]],
  ['milkshake', 'Fruit Milkshake', 'S', [['milk', 1], ['sugar', 2, 'honey', 2], ['berries', 0.5, 'banana', 1, 'peach', 1, 'mango', 0.5]]],
  // chicken
  ['chicken-veggies', 'Chicken & Veggies', 'D', [['chicken', 4], ['broccoli', 1, 'carrot', 1, 'veg', 1, 'pepper', 1, 'squash', 1], OIL1]],
  ['chicken-pot-pie', 'Chicken Pot Pie', 'D', [['chicken', 3], ['flour', 0.3], ['milk', 0.5], ['carrot', 0.5, 'peas', 0.5, 'veg', 0.75, 'potato', 0.5], ['butter', 2, 'oil', 2]]],
  ['chicken-dumplings', 'Chicken & Dumplings', 'D', [['chicken', 3], ['flour', 0.3], ['milk', 0.25], ['?carrot', 1]]],
  ['bbq-chicken', 'BBQ Chicken', 'D', [['chicken', 5], ['sugar', 1, 'honey', 1], ['?tomato', 0.5]]],
  ['honey-chicken', 'Honey Garlic Chicken', 'D', [['chicken', 4], ['honey', 1.5], ['?rice', 1]]],
  ['orange-chicken', 'Orange Chicken', 'D', [['chicken', 4], ['orange', 1], ['sugar', 1, 'honey', 1], ['?flour', 0.1], ['?rice', 1]]],
  ['pineapple-chicken', 'Pineapple Chicken', 'D', [['chicken', 4], ['pineapple', 0.5], ['?pepper', 0.5], ['?rice', 1]]],
  ['mango-chicken', 'Mango Chicken', 'D', [['chicken', 4], ['mango', 0.5], ['?rice', 1], ['?pepper', 0.5]]],
  ['chicken-avocado-salad', 'Chicken Avocado Salad', 'L', [['lettuce', 2, 'spinach', 1.5], ['chicken', 3], ['avocado', 0.5], ['?tomato', 0.5]]],
  ['chicken-wrap', 'Chicken Wrap', 'L', [TORT, ['chicken', 3], ['lettuce', 0.5, 'spinach', 0.5], ['?cheese', 1], ['?tomato', 0.25]]],
  ['chicken-lettuce-wraps', 'Lettuce Wraps', 'L', [['lettuce', 1], ['chicken', 3, 'beef', 3], ['?carrot', 0.5], ['?pepper', 0.25]]],
  ['chicken-bean-chili', 'White Chicken Chili', 'D', [['chicken', 3], ['beans', 1], ['?corn', 0.5], ['?milk', 0.25]]],
  ['chicken-sweet-potato', 'Chicken & Sweet Potato', 'D', [['chicken', 4], ['potato', 1], ['?broccoli', 1, 'spinach', 1]]],
  ['chicken-parm', 'Chicken Parmesan', 'D', [['chicken', 4], ['cheese', 1], ['tomato', 1], ['flour', 0.15, 'bread', 1], ['?pasta', 1]]],
  // beef & steak
  ['steak-salad', 'Steak Salad', 'L', [['beef', 4], ['lettuce', 2, 'spinach', 1.5], ['?tomato', 0.5], ['?cheese', 0.5]]],
  ['steak-veggies', 'Steak & Veggies', 'D', [['beef', 5], ['broccoli', 1, 'carrot', 1, 'veg', 1, 'pepper', 1, 'greenbeans', 1], ['?butter', 1]]],
  ['steak-rice', 'Steak & Rice', 'D', [['beef', 5], ['rice', 1]]],
  ['taco-salad', 'Taco Salad', 'L', [['lettuce', 2], ['beef', 3], ['cheese', 1, 'beans', 0.5], ['?tomato', 0.5], ['?corn', 0.5]]],
  ['beef-potato-skillet', 'Beef & Potato Skillet', 'D', [['beef', 3], ['potato', 1], OIL1, ['?onion', 0.25], ['?pepper', 0.25]]],
  ['steak-fajita-bowl', 'Steak Fajita Bowl', 'D', [['beef', 4], ['rice', 1], ['pepper', 1], ['?beans', 0.5], ['?corn', 0.5]]],
  ['beef-carrot-stew', 'Beef & Carrot Stew', 'D', [['beef', 4], ['carrot', 2], ['?onion', 0.5], ['?veg', 1]]],
  ['beef-bean-burrito', 'Beef & Bean Burrito', 'L', [TORT, ['beef', 2], ['beans', 0.5], ['?cheese', 1], ['?lettuce', 0.25]]],
  // pork / bacon
  ['bacon-potatoes', 'Bacon & Potatoes', 'D', [['pork', 2], ['potato', 1], ['?onion', 0.25], ['?cheese', 1]]],
  ['bacon-wrapped-chicken', 'Bacon-Wrapped Chicken', 'D', [['chicken', 4], ['pork', 1.5]]],
  ['bacon-broccoli', 'Bacon Broccoli', 'D', [['broccoli', 1.5], ['pork', 1]]],
  ['hawaiian-pizza', 'Homemade Hawaiian Pizza', 'D', [['flour', 0.5], ['cheese', 2], ['tomato', 1], ['pork', 1.5], ['pineapple', 0.5]]],
  ['pineapple-fried-rice', 'Pineapple Fried Rice', 'D', [['rice', 1.5], ['pineapple', 0.5], ['egg', 1], OIL1, ['?pork', 2, 'chicken', 2]]],
  ['hot-dog-beans', 'Franks & Beans', 'L', [['pork', 3], ['beans', 1], ['?sugar', 1]]],
  // fish & seafood
  ['honey-salmon', 'Honey-Glazed Salmon', 'D', [['fish', 5], ['honey', 1, 'sugar', 1]]],
  ['salmon-potatoes', 'Salmon & Potatoes', 'D', [['fish', 5], ['potato', 1], OIL1]],
  ['fish-veggies', 'Fish & Veggies', 'D', [['fish', 5], ['broccoli', 1, 'carrot', 1, 'veg', 1, 'spinach', 1, 'pepper', 1], FAT1]],
  ['salmon-salad', 'Salmon Salad', 'L', [['fish', 4], ['lettuce', 2, 'spinach', 1.5], ['?avocado', 0.5], ['?cucumber', 0.5]]],
  ['salmon-bowl', 'Salmon Rice Bowl', 'D', [['fish', 4], ['rice', 1], ['?avocado', 0.5], ['?cucumber', 0.5], ['?carrot', 0.5]]],
  ['coconut-shrimp', 'Coconut Shrimp', 'D', [['fish', 4], ['coconut', 0.25], ['flour', 0.15, 'egg', 0.5], ['oil', 2]]],
  ['fish-burrito', 'Fish Burrito', 'L', [TORT, ['fish', 3], ['rice', 0.5, 'beans', 0.5], ['?cabbage', 0.5, 'lettuce', 0.5]]],
  // beans, rice, veggies
  ['black-bean-soup', 'Black Bean Soup', 'L', [['beans', 1.5], ['?onion', 0.25], ['?tomato', 0.5], ['?carrot', 0.5]]],
  ['bean-salad', 'Bean & Corn Salad', 'L', [['beans', 0.75], ['corn', 0.5], ['?tomato', 0.5], ['?pepper', 0.25], ['?onion', 0.25], ['?oil', 1]]],
  ['bean-cheese-quesadilla', 'Bean & Cheese Quesadilla', 'L', [TORT2, ['beans', 0.5], ['cheese', 1.5]]],
  ['beans-rice-cheese', 'Cheesy Rice & Beans', 'L', [['rice', 1], ['beans', 0.75], ['cheese', 1]]],
  ['buttered-rice', 'Buttered Rice', 'D', [['rice', 1], FAT1]],
  ['cheesy-rice', 'Cheesy Rice', 'D', [['rice', 1], ['cheese', 1], ['?milk', 0.25]]],
  ['coconut-rice', 'Coconut Rice', 'D', [['rice', 1], ['coconut', 0.25]]],
  ['veggie-rice-bowl', 'Veggie Rice Bowl', 'L', [['rice', 1], ['broccoli', 1, 'veg', 1, 'carrot', 1, 'pepper', 1, 'spinach', 1], ['?egg', 1], ['?beans', 0.5]]],
  ['mango-sticky-rice', 'Mango Sticky Rice', 'S', [['rice', 1], ['mango', 0.5], ['coconut', 0.25, 'milk', 0.5, 'cream', 2], ['sugar', 1, 'honey', 1]]],
  ['honey-carrots', 'Honey-Glazed Carrots', 'D', [['carrot', 2], ['honey', 1, 'sugar', 1], ['?butter', 1]]],
  ['roasted-carrots-potatoes', 'Roasted Carrots & Potatoes', 'D', [['carrot', 1.5], ['potato', 1], OIL1]],
  ['carrot-soup', 'Carrot Soup', 'L', [['carrot', 3], ['?onion', 0.25], ['?milk', 0.25, 'cream', 2]]],
  ['carrot-cake', 'Carrot Cake', 'S', [['carrot', 0.5], ['flour', 0.25], ['sugar', 3], ['egg', 0.5], ['oil', 2, 'butter', 2]]],
  ['broccoli-cheese-soup', 'Broccoli Cheese Soup', 'L', [['broccoli', 1], ['milk', 1, 'cream', 4], ['cheese', 1.5], ['?flour', 0.1]]],
  ['broccoli-rice', 'Broccoli Rice', 'D', [['broccoli', 1], ['rice', 1], ['?cheese', 1], ['?butter', 1]]],
  ['cheesy-potatoes', 'Cheesy Potatoes', 'D', [['potato', 1], ['cheese', 1.5], ['?milk', 0.25, 'cream', 2], ['?butter', 1]]],
  ['potato-wedges', 'Potato Wedges', 'S', [['potato', 1], ['oil', 1, 'butter', 1]]],
  ['sweet-potato-fries', 'Sweet Potato Fries', 'S', [['potato', 1], ['oil', 1.5]]],
  ['elote', 'Street Corn (Elote)', 'S', [['corn', 1], ['cheese', 0.5], ['?butter', 1]]],
  ['corn-salsa', 'Corn Salsa', 'S', [['corn', 0.5], ['tomato', 0.5, 'pepper', 0.5, 'beans', 0.5], ['?onion', 0.25]]],
  ['cucumber-salad', 'Cucumber Salad', 'S', [['cucumber', 1], ['?tomato', 0.5], ['?onion', 0.25], ['?oil', 1]]],
  ['caprese', 'Tomato & Cheese Salad', 'S', [['tomato', 1], ['cheese', 1], ['?oil', 1]]],
  ['avocado-salad', 'Avocado Salad', 'L', [['avocado', 0.5], ['tomato', 0.5, 'cucumber', 0.5, 'corn', 0.5], ['?lettuce', 1], ['?onion', 0.25]]],
  ['mango-salsa', 'Mango Salsa', 'S', [['mango', 0.5], ['?tomato', 0.5], ['?pepper', 0.25], ['?onion', 0.25]]],
  ['veggie-omelet-2', 'Garden Omelet', 'B', [['egg', 3], ['veg', 0.5, 'spinach', 0.5, 'broccoli', 0.5, 'tomato', 0.5, 'mushroom', 0.5], ['?cheese', 1], FAT1]],
  ['vegetable-soup-2', 'Garden Vegetable Soup', 'L', [['veg', 1.5, 'carrot', 2, 'broccoli', 1.5, 'squash', 1.5], ['potato', 1, 'beans', 0.5, 'rice', 0.5, 'pasta', 0.5], ['?tomato', 1]]],
  ['veggie-pasta', 'Veggie Pasta', 'D', [PASTA, ['broccoli', 1, 'veg', 1, 'spinach', 1, 'squash', 1, 'tomato', 1], OIL1, ['?cheese', 1]]],
  ['creamy-pasta', 'Creamy Pasta', 'D', [PASTA, ['cream', 4, 'milk', 0.75], ['?cheese', 1], ['?butter', 1]]],
  // fruit, snacks & desserts
  ['fruit-salad-2', 'Tropical Fruit Salad', 'S', [['mango', 0.5, 'pineapple', 0.75, 'kiwi', 2], ['melon', 1, 'orange', 1, 'banana', 1, 'grapes', 0.5, 'berries', 0.5], ['?kiwi', 1], ['?coconut', 0.1]]],
  ['berry-melon-bowl', 'Melon & Berry Bowl', 'S', [['melon', 1.5], ['berries', 0.5, 'grapes', 0.5, 'kiwi', 1, 'cherries', 0.5]]],
  ['citrus-salad', 'Citrus Salad', 'S', [['orange', 2], ['?kiwi', 1], ['?berries', 0.5], ['?honey', 1]]],
  ['fruit-yogurt-bowl', 'Fruit & Yogurt Bowl', 'S', [['yogurt', 1], ['mango', 0.5, 'peach', 1, 'kiwi', 1, 'cherries', 0.5, 'pineapple', 0.5, 'apple', 1, 'orange', 1, 'grapes', 0.5]]],
  ['choc-strawberries', 'Chocolate-Dipped Strawberries', 'S', [['berries', 1], ['chocolate', 1]]],
  ['berries-cream', 'Berries & Cream', 'S', [['berries', 1], ['cream', 2, 'yogurt', 0.5, 'milk', 0.5], ['?sugar', 1]]],
  ['choc-banana', 'Chocolate Banana Bites', 'S', [['banana', 1], ['chocolate', 1, 'pb', 1]]],
  ['frozen-yogurt-bark', 'Frozen Yogurt Bark', 'S', [['yogurt', 1], ['berries', 0.5, 'mango', 0.5, 'banana', 0.5, 'kiwi', 1], ['?honey', 1], ['?chocolate', 0.5]]],
  ['peach-cobbler', 'Peach Cobbler', 'S', [['peach', 2], ['flour', 0.25], ['sugar', 2], ['butter', 2, 'oil', 2]]],
  ['cherry-pie', 'Cherry Pie', 'S', [['cherries', 1], ['flour', 0.25], ['sugar', 2], ['butter', 2, 'oil', 2]]],
  ['baked-pears', 'Baked Pears', 'S', [['pear', 1], ['?honey', 1], ['?nuts', 0.5]]],
  ['pear-cheese', 'Pear & Cheese', 'S', [['pear', 1], ['cheese', 1]]],
  ['apple-pancakes', 'Apple Pancakes', 'B', [['flour', 0.5], ['egg', 1], ['milk', 0.5], ['apple', 0.5], OIL1]],
  ['caramel-apples', 'Caramel Apple Slices', 'S', [['apple', 1], ['honey', 2, 'sugar', 2]]],
  ['nut-mix', 'Nut & Fruit Mix', 'S', [['nuts', 1, 'peanuts', 1], ['grapes', 0.25, 'cherries', 0.25, 'coconut', 0.1, 'chocolate', 0.5]]],
  ['honey-almonds', 'Honey-Roasted Almonds', 'S', [['nuts', 1], ['honey', 1, 'sugar', 1]]],
  ['buttered-popcorn', 'Buttered Popcorn', 'S', [['popcorn', 3], ['?butter', 1]]],
  ['kettle-corn', 'Kettle Corn', 'S', [['popcorn', 3], ['sugar', 1], ['oil', 1]]],
  ['honey-bread', 'Honey Wheat Bread', 'S', [['flour', 0.5], ['honey', 1], ['?butter', 1]]],
  ['cinnamon-rolls', 'Cinnamon Rolls', 'S', [['flour', 0.4], ['sugar', 2], ['butter', 2, 'oil', 2], ['?milk', 0.25]]],
  ['coconut-macaroons', 'Coconut Macaroons', 'S', [['coconut', 0.5], ['egg', 0.5], ['sugar', 1, 'honey', 1], ['?chocolate', 0.5]]],
  ['whipped-cream-fruit', 'Whipped Cream & Fruit', 'S', [['cream', 3], ['berries', 0.5, 'peach', 1, 'banana', 1, 'cherries', 0.5, 'mango', 0.5], ['?sugar', 1]]],
  ['chocolate-mousse', 'Chocolate Mousse', 'S', [['chocolate', 1], ['cream', 4, 'milk', 1], ['?sugar', 1]]],
  ['hot-cocoa-cream', 'Hot Cocoa with Cream', 'S', [['milk', 1], ['chocolate', 1], ['cream', 1]]],
  ['cottage-cheese-pancakes', 'Protein Pancakes', 'B', [['cottage', 0.5], ['egg', 2], ['oats', 0.5, 'flour', 0.25]]]
];

// ───────── helpers ─────────
function frac(n) {
  const w = Math.floor(n + 1e-9), r = n - w;
  const F = [[0, ''], [0.125, '⅛'], [0.25, '¼'], [1 / 3, '⅓'], [0.5, '½'], [2 / 3, '⅔'], [0.75, '¾']];
  let best = F[0], d = 9;
  F.forEach(f => { const x = Math.abs(r - f[0]); if (x < d) { d = x; best = f; } });
  if (d > 0.06) return String(Math.round(n * 100) / 100);
  if (Math.abs(r - 1) < 0.06) return String(w + 1);
  return (w ? w + (best[1] ? ' ' : '') : '') + (best[1] || (w ? '' : '0'));
}
function plural(u, n) {
  if (n <= 1 || /oz|tbsp|tsp/.test(u)) return u;
  if (/(o|ch)$/.test(u)) return u + 'es';
  return u + 's';
}
function amountText(key, a) {
  const g = ING[key]; if (!g) return a + ' ' + key;
  return frac(a) + ' ' + plural(g[1], a);
}

// Parse a student's serving text ("1/4 cup", "2 large", "4 oz cooked", "1 can (12 oz)") -> {fam, qty} in base units
const NUM = '(\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d*\\.\\d+|\\d+|[½¼¾⅓⅔⅛])';
function numVal(s) {
  const u = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125 }; if (u[s]) return u[s];
  if (/\s/.test(s)) { const [w, f] = s.split(/\s+/); return +w + numVal(f); }
  if (s.includes('/')) { const [a, b] = s.split('/'); return +a / +b; }
  return +s;
}
function parseServing(txt) {
  const t = String(txt || '').toLowerCase().replace(/\(.*?\)/g, ' ').trim();
  const m = t.match(new RegExp('^' + NUM + '?\\s*(.*)$'));
  if (!m) return null;
  const q = m[1] ? numVal(m[1]) : 1, rest = m[2] || '';
  if (!(q > 0)) return null;
  if (/^(cups?|c\b)/.test(rest)) return { fam: 'vol', tbsp: q * 16 };
  if (/^(tbsp|tablespoons?|tbs|T\b)/.test(rest)) return { fam: 'vol', tbsp: q };
  if (/^(tsp|teaspoons?)/.test(rest)) return { fam: 'vol', tbsp: q / 3 };
  if (/^(fl\.? ?oz|fluid)/.test(rest)) return { fam: 'vol', tbsp: q * 2, oz: q };
  if (/^(oz|ounces?)/.test(rest)) return { fam: 'wt', oz: q, tbsp: q * 2 };
  if (/^(lbs?|pounds?)/.test(rest)) return { fam: 'wt', oz: q * 16 };
  if (/^(g|grams?)\b/.test(rest)) return { fam: 'wt', oz: q / 28.35 };
  if (/^(kg)/.test(rest)) return { fam: 'wt', oz: q * 35.27 };
  // count words (slice, egg, large, medium, small, whole, piece, each, item, tortilla, potato…), or nothing
  return { fam: 'count', n: q };
}
const BASE_TBSP = { cup: 16, tbsp: 1 };
// How many of the student's servings equal `a` base units of ingredient `key`? null = can't convert.
function toServings(key, a, servingTxt) {
  const g = ING[key], p = parseServing(servingTxt); if (!g || !p) return null;
  if (g[2] === 'vol') {
    if (p.fam === 'vol' || (p.fam === 'wt' && p.tbsp)) return a * BASE_TBSP[g[1]] / p.tbsp;
    return null;
  }
  if (g[2] === 'wt') return p.fam === 'wt' ? a / p.oz : null;
  if (g[2] === 'count') return p.fam === 'count' ? a / p.n : null;
  return null;
}

// Which ingredient is this pallet food? Whole dishes (pizza, burritos, soup…) never count as ingredients.
// A "Combination" burger is a dish; a "Natural" hamburger is ground beef.
function matchFood(name, type) {
  const n = ' ' + String(name || '').toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ') + ' ';
  if (DISH_WORDS.test(n) && !/\bchicken wings?\b/.test(n)) return null;
  if (type === 'C' && BURGER.test(n)) return null;
  for (const k of MATCH_ORDER) if (ING[k][3].test(n)) return k;
  return null;
}

/* kitchen(foods, nut, extraRecipes) -> { map: {ingKey: foodIndex}, can: [...], almost: [...], byId: {} }
 * can[i] = { id, name, tag, parts: [{k, i, a, srv, est, nut:[5]}], nut: {cal,pro,carb,fat,fib}, est: bool } */
function kitchen(foods, nut, extra) {
  const map = {};
  foods.forEach((f, i) => { if (!f || !String(f.name || '').trim()) return; const k = matchFood(f.name, f.type); if (k && map[k] == null) map[k] = i; });
  const all = RECIPES.map(r => ({ id: r[0], name: r[1], tag: r[2], ings: r[3] }))
    .concat((extra || []).map(r => ({ id: r.id, name: r.name, tag: 'U', ings: r.ings, custom: true })));
  const can = [], almost = [], byId = {};
  const seen = new Set();
  all.forEach(r => {
    if (seen.has(r.id)) return; seen.add(r.id);
    const parts = [], missing = [];
    (r.ings || []).forEach(e => {
      // [key, amount, altKey, altAmount, altKey2, altAmount2, …] — the first one on the pallet is used
      let k = String(e[0]); const opt = k.startsWith('?'); if (opt) k = k.slice(1);
      const choices = [[k, +e[1]]]; for (let j = 2; j + 1 < e.length; j += 2) choices.push([String(e[j]), +e[j + 1]]);
      const use = choices.find(c => map[c[0]] != null) || null;
      if (!use) { if (!opt) missing.push(choices.filter(c => ING[c[0]]).map(c => ING[c[0]][0]).join(' or ')); return; }
      if (parts.some(p => p.k === use[0])) return;
      parts.push({ k: use[0], i: map[use[0]], a: use[1] });
    });
    if (!missing.length && parts.length) {
      const t = { cal: 0, pro: 0, carb: 0, fat: 0, fib: 0 }; let est = false;
      parts.forEach(p => {
        const n = nut[p.i] || {}, s = toServings(p.k, p.a, n.serving);
        const labelOk = s != null && isFinite(s) && s > 0 && ['cal', 'pro', 'carb', 'fat', 'fib'].every(x => n[x] !== '' && n[x] != null && isFinite(n[x]));
        if (labelOk) { p.srv = s; p.nut = ['cal', 'pro', 'carb', 'fat', 'fib'].map(x => +n[x] * s); }
        else { p.srv = null; p.est = est = true; p.nut = ING[p.k][4].map(v => v * p.a); }
        ['cal', 'pro', 'carb', 'fat', 'fib'].forEach((x, j) => { t[x] += p.nut[j]; });
      });
      const d = { id: r.id, name: r.name, tag: r.tag, custom: !!r.custom, parts, nut: t, est };
      can.push(d); byId[r.id] = d;
    } else if (missing.length === 1 && parts.length) {
      almost.push({ id: r.id, name: r.name, missing: missing[0] });
    }
  });
  can.sort((a, b) => a.name.localeCompare(b.name)); almost.sort((a, b) => a.name.localeCompare(b.name));
  return { map, can, almost, byId };
}

window.WCQ_BOOK = { ING, RECIPES, kitchen, matchFood, parseServing, toServings, amountText, frac,
  ingList: () => Object.keys(ING).map(k => ({ k, name: ING[k][0], unit: ING[k][1] })) };
})();
