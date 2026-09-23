// The Eckert family recipe book, converted to structured data.
// Each recipe: title, meta, ingredients (one per line; "Section:" lines start a section), steps (one per line).
// Build SQL with:  node seed/build.mjs   →  supabase/seed_recipes.sql

const R = (title, m, ingredients, steps) => ({ title, ...m, ingredients: ingredients.trim(), steps: steps.trim() });
const E = "Entree", S = "Side", A = "Appetizer", D = "Dessert";
const Q30 = "30-minute meal", CP = "crockpot", SOUP = "soup", CAS = "casserole", ONE = "one pan", FB = "Facebook video";

export const RECIPES = [
// ============================================================ ENTREES
R("Chicken Pomodoro", { course: E, protein: "Chicken", cuisine: "Italian", tags: [Q30, "pasta"], total: 30,
  notes: "Add whatever optional veggies you like or have on hand." }, `
3 tbsp olive oil
1 tbsp butter
Red pepper flakes
Italian seasoning (or basil & parsley)
1/2 tbsp chicken bouillon base
Mixed veggies
Garlic
Onion
15 oz canned tomatoes
Chicken
Pasta, for serving
Optional add-ins:
1 cup spinach, shredded
2–4 stalks asparagus
1/2 cup broccoli
1/2 cup cauliflower
1/2 cup chopped eggplant
1/2 cup chopped squash (zucchini or yellow)
Black olives`, `
Start the pasta. While it cooks, heat the olive oil, butter and seasonings over medium heat.
Add garlic, bouillon base and onion and sauté until cooked.
Add the veggies in stages so each cooks through (peppers take longer than mushrooms).
Once the mixture is cooked, add the canned tomatoes and chicken and cook until warm, 1–2 minutes. Add a couple spoonfuls of pasta water as needed.
Serve over pasta.`),

R("Sausage Alfredo", { course: E, protein: "Turkey", cuisine: "Cajun", tags: [Q30, "pasta"], total: 30, credit: "Jen Sorrels" }, `
8 oz pasta, cooked and drained
2 cups heavy cream
2 tsp cajun seasoning
1/2 cup grated parmesan
Turkey sausage
Peas or other veggies (optional)`, `
Prepare the pasta and set aside.
Sauté the sausage for 5 minutes.
Add the cream and cajun seasoning and bring to a boil.
Reduce heat and simmer 3–4 minutes, or until the mixture thickens.
Stir in the parmesan. Add the pasta and toss.
Optional: add peas or other veggies.`),

R("Chicken Pot Pie", { course: E, protein: "Chicken", cuisine: "American", tags: [Q30, CAS], total: 30 }, `
3 chicken breasts
1 can cream of chicken soup
1 can cream of celery soup
Various veggies
1 can biscuits`, `
Cook the chicken breasts and set aside 1 cup of the chicken broth.
Remove the chicken from the bone.
Add the chicken pieces and veggies to the soups in a medium saucepan. Add small amounts of broth until it reaches the thickness you like.
Bring to a boil, then pour into a casserole dish.
Place the biscuits on top of the soup mixture.
Bake 15 minutes at 400°F.`),

R("Salsa Verde Chicken Enchiladas", { course: E, protein: "Chicken", cuisine: "Tex-Mex", tags: [CAS], cook: 25, servings: "8 enchiladas" }, `
1 (16 oz) jar salsa verde
2 cups shredded pepper jack cheese, divided
3 cups cooked chicken, chopped (about 12 oz; rotisserie works)
8 medium flour tortillas
Cooking spray`, `
Preheat oven to 350°F. Spray a 9x13 baking dish with cooking spray.
Spoon a thin layer of salsa verde into the bottom of the dish.
Combine the chicken, 1 cup salsa and 1 cup cheese in a bowl.
Spoon about ⅓ cup of the mixture down the middle of a tortilla. Fold the sides over and place seam-side down in the dish. Repeat.
Top with the remaining salsa and 1 cup cheese.
Bake uncovered 20–30 minutes until bubbly. Serve and enjoy!`),

R("Kielbasa, Pepper, Onion & Potato Hash", { course: E, protein: "Turkey", cuisine: "American", tags: ["skillet"], cook: 25 }, `
1 (14 oz) package turkey kielbasa, cut into ¼-inch rounds
1 green bell pepper, diced
1/2 yellow or red bell pepper, diced
1 onion, diced
3 small or 2 large potatoes, peeled and diced
Olive oil
Salt & pepper`, `
In a heavy-bottomed skillet (cast iron recommended), heat 2 tbsp olive oil over medium-high heat.
Add the potatoes and season with salt and pepper. Fry until golden brown and cooked through, 8–10 minutes, stirring a few times for even browning.
In a separate skillet, brown the kielbasa in 1 tbsp olive oil over medium-high heat, about 5 minutes. Remove and set aside.
Add the peppers and onions to that skillet with a pinch of salt and pepper. Cook 5 minutes, or until softened, stirring occasionally.
Add the potatoes and kielbasa to the peppers and onions and mix everything together. Serve and enjoy!`),

R("Stir Fry", { course: E, protein: "Chicken", cuisine: "Asian", tags: [Q30], total: 30, notes: "Works with beef or chicken." }, `
Beef or chicken
Mixed veggies
Cornstarch
Soy sauce
Worcestershire sauce
Oil
Rice, for serving`, `
Steam-cook the meat in a pan with a little soy sauce. Set aside.
Flash-fry the veggies in oil.
Once cooked, mix a cornstarch and soy sauce slurry with Worcestershire sauce.
Mix everything together to reheat. Serve over rice.`),

R("Chicken Noodle Soup", { course: E, protein: "Chicken", cuisine: "American", tags: [SOUP] }, `
Frozen egg noodles
Bouillon cubes (1 per cup of water)
Canned or pulled chicken
Onion, celery and carrots`, `
Bring water to a boil with bouillon (1 cube per cup of water).
Add the veggies and bring back to a boil.
Add the noodles and cook until tender.
Add the chicken, reheat and serve.`),

R("Beef Stroganoff", { course: E, protein: "Beef", cuisine: "American", tags: ["pasta"] }, `
1 lb sirloin, cut ¼ to ½ inch thick
1 cup water
1 (3 oz) can sliced mushrooms
1 envelope onion soup mix
1 cup sour cream
2 tbsp flour
1 pkg egg noodles
3 tbsp oil
Butter, for the noodles`, `
Trim the fat from the steak and cut into small pieces.
Brown the steak in 3 tbsp oil.
Add the water and the mushrooms with their liquid. Stir in the soup mix and heat to boiling.
Simmer 5–10 minutes.
Blend the sour cream and flour and add to the steak and mushrooms, cooking slowly until thickened.
Serve over hot buttered noodles.`),

R("Gnocchi", { course: E, protein: "Vegetarian", cuisine: "Italian", tags: ["pasta", "from scratch"] }, `
Gnocchi:
4 large russet potatoes, peeled
1 tsp salt
2 eggs
3 cups flour
To serve:
Tomato sauce
Mozzarella cheese`, `
Boil the potatoes for 40 minutes. Rice them and cool completely.
Make a well in the potatoes and mix in the remaining ingredients.
Knead the dough and roll it into snakes. Cut into dumplings.
Use a cheese scraper to roll the dumplings, then let them dry on a floured tray.
Add the dumplings to boiling water and cook until they float, about 3 minutes.
Place in a baking dish, cover with tomato sauce and top with mozzarella.
Bake at 375°F until the cheese is melted.`),

R("Flank Steak with Chimichurri", { course: E, protein: "Beef", cuisine: "Argentinian", tags: [Q30], total: 30, servings: "4–6" }, `
Steak:
1 1/2 lb trimmed flank steak
1 1/2 tsp kosher salt, divided
1 1/2 tsp ground cumin
1/2 tsp ground coriander
1/4 tsp black pepper
Chimichurri:
1 large clove garlic
1 1/2 cups fresh cilantro
1 1/2 cups fresh flat-leaf parsley
1/2 cup olive oil
2 tbsp distilled white vinegar
1/4 tsp cayenne pepper`, `
Pat the steak dry. Stir together 1 tsp of the salt, the cumin, coriander and pepper, and rub onto both sides of the steak.
For medium-rare, broil in a broiler pan 6 minutes per side. Transfer to a cutting board and rest 5 minutes.
Meanwhile, blend the garlic, oil, vinegar, cayenne and remaining ½ tsp salt in a food processor until the garlic is finely chopped.
Add the cilantro and parsley and pulse until thoroughly blended.
Holding the knife at a 45° angle, thinly slice the steak. Serve with the sauce.`),

R("Chicken Gumbo", { course: E, protein: "Chicken", cuisine: "Cajun", tags: [SOUP], cook: 25, servings: "6" }, `
3 tbsp margarine
1 (16 oz) pkg frozen cut okra
1 small onion, chopped (about ¼ cup)
1/2 small green pepper, chopped
3 cans chicken broth
1 (16 oz) can diced tomatoes
1 small bay leaf
1 tsp salt
1 dash pepper
2 cups shredded chicken
1 tbsp snipped parsley
Cooked rice, for serving`, `
Melt the margarine in a saucepan. Add the okra, onion and green pepper and cook, stirring, until the onion is tender.
Stir in the broth, tomatoes (with liquid), bay leaf, salt and pepper. Heat to boiling.
Reduce heat and simmer uncovered 15 minutes.
Stir in the chicken and parsley and heat through.
Serve over hot rice.`),

R("Sausage and Cheesy Orzo", { course: E, protein: "Pork", cuisine: "American", tags: ["skillet", "pasta"], cook: 25 }, `
1 1/2 cups uncooked orzo
2 tbsp vegetable or olive oil
1 small onion, diced
1 clove garlic, minced
1/2 green bell pepper, diced
1 cup bite-size broccoli florets
1 (16 oz) package smoked sausage or turkey kielbasa
Salt and pepper
1/3 cup milk
1 1/2 cups shredded cheddar cheese`, `
In a large pot, bring 3 quarts of water to a boil. Precook the broccoli in it for about 3 minutes, then cook the orzo in the same water per package directions.
While the orzo cooks, dice the onion and bell pepper, mince the garlic, and cut the sausage into ½-inch rounds.
Heat the oil in a large skillet over medium heat. Cook the onion and bell pepper until soft, then add the garlic and sausage.
Drain the orzo and set aside.
When the sausage is browned, add the orzo and broccoli to the skillet and lower the heat to medium-low.
Stir in the cheese, milk, salt and pepper. Serve and enjoy.`),

R("Sauerkraut", { course: E, protein: "Pork", cuisine: "German", tags: [] }, `
1 can sauerkraut
1 lb Polish sausage, cut in ½-inch slices
4 medium potatoes, cut in large chunks
Caraway seeds
1/8 cup brown sugar
Salt and pepper`, `
Combine everything in a medium saucepan and add one can of water.
Simmer until the potatoes are tender.
Salt and pepper to taste.`),

R("Chili", { course: E, protein: "Beef", cuisine: "Tex-Mex", tags: [SOUP] }, `
1 lb ground beef
1 small onion, chopped
1/2 green pepper, chopped
1 stalk celery, chopped
1 can ranch style beans, with liquid
1 can kidney beans
1 can diced tomatoes
3 small cans tomato sauce
2 cups water
Salt, black pepper, chili powder, parsley and cumin, to taste
For serving (optional):
Cooked elbow macaroni
Fritos
Cheddar cheese`, `
Brown the ground beef. Add the onion, green pepper and celery and cook until the onion is tender.
Add the beans, tomatoes, tomato sauce and water.
Heat, and season to taste with salt, pepper, chili powder, parsley and cumin.
Serve over cooked elbow macaroni if you like, topped with Fritos and cheddar cheese.`),

R("Chicken Sopa", { course: E, protein: "Chicken", cuisine: "Tex-Mex", tags: [CAS] }, `
1 cooked chicken, boned
1 pkg corn chips
3/4 stick margarine
1 medium onion, chopped
1 can cream of chicken soup
1/2 lb Velveeta cheese
1 small can evaporated milk
2 jalapeños or green chili peppers, seeded and chopped`, `
In a saucepan over low heat, heat the margarine, onion, cream of chicken soup, cheese and evaporated milk.
Add the chicken to the sauce.
Add the chopped jalapeños or green chilies (without seeds).`),

R("Taco Soup", { course: E, protein: "Beef", cuisine: "Tex-Mex", tags: [SOUP] }, `
Brown:
2 lb ground beef
1 small onion, chopped
1 pkg taco seasoning
Add:
2 cups water
2 cans ranch style beans, with juice
1 can pinto beans, with juice (optional: with jalapeños)
1 can diced tomatoes
1 can Rotel tomatoes
1 can hominy or corn
1 pkg taco seasoning (the second packet)
1 pkg ranch-style buttermilk dressing mix`, `
Brown the ground beef and onion with the first package of taco seasoning.
Add the water, beans with their juice, tomatoes, Rotel, hominy or corn, the second package of taco seasoning and the ranch dressing mix.
Heat through, adding more water if necessary.`),

R("Cheesy Chicken Avocado Wraps", { course: E, protein: "Chicken", cuisine: "Tex-Mex", tags: [Q30], total: 30 }, `
2 cups cooked chicken
1 avocado, diced
1/2 cup shredded cheese
Cilantro
Salt and pepper
Large tortillas
1 tbsp oil`, `
Mix the chicken, avocado, cheese, cilantro, salt and pepper.
Roll into burritos.
Heat a tablespoon of oil on a griddle. Press the burritos into the pan until golden on both sides.`),

R("Crockpot French Dip Sandwiches", { course: E, protein: "Beef", cuisine: "American", tags: [CP, "freezer friendly"], cook: 360, credit: "Jen Sorrels", servings: "4–6",
  notes: "Freeze ½–⅔ for future meals!" }, `
3 lb beef chuck roast
16 oz canned beef broth (about 1 1/2 cans)
1 (10.5 oz) can condensed French onion soup
6 oz red wine (drink the rest with dinner!)
1 tsp garlic powder
Salt and pepper, to taste
4–6 French rolls, cut in half
Sliced provolone cheese`, `
Trim the excess fat off the roast and season with salt and pepper.
Pour the beef broth, French onion soup, red wine and garlic powder into the slow cooker and place the roast in the liquid.
Cook on low 6–8 hours.
Take the beef out and let it rest 10 minutes. Slice it and return to the slow cooker.
Lightly toast the rolls and divide the cheese between them.
Divide the beef onto the rolls and serve with the juice in small bowls for dipping.`),

R("Italian Sausage Tortellini Soup", { course: E, protein: "Pork", cuisine: "Italian", tags: [SOUP, "pasta"], cook: 55 }, `
1 (3.5 oz) link sweet Italian sausage, casing removed
1 cup chopped onion
2 cloves garlic, minced
5 cups beef stock
1/3 cup water
1/2 cup red wine
4 tomatoes, peeled, seeded and chopped
1 cup chopped carrots
1/2 tsp dried basil
1/2 tsp dried oregano
1 cup tomato sauce
1 zucchini, chopped
8 oz cheese tortellini
1 green bell pepper, chopped
1 tbsp chopped fresh parsley
2 tbsp grated parmesan, for topping`, `
Brown the sausage in a large pot over medium-high heat, about 10 minutes.
Drain all but about 1 tablespoon of fat. Add the onion and garlic and sauté 5 more minutes.
Add the beef stock, water, wine, tomatoes, carrots, basil, oregano and tomato sauce. Bring to a boil.
Reduce heat to low and simmer 30 minutes, skimming off any fat that surfaces.
Add the zucchini, tortellini, green pepper and parsley. Simmer 10 minutes, or until the tortellini is cooked.
Ladle into bowls and garnish with parmesan.`),

R("Poppyseed Chicken", { course: E, protein: "Chicken", cuisine: "American", tags: [CAS, "pasta"], cook: 25 }, `
3–4 chicken breasts, cooked and cut in small pieces
1 box linguine, cooked
2 cans cream soup (chicken, celery or mushroom)
8 oz sour cream
1 sleeve Ritz crackers
1 stick butter, melted
1 tbsp poppyseeds`, `
Mix the cream soups and sour cream together. Add the chicken and linguine.
Spread in a greased 9x13 pan.
Crush the Ritz crackers and mix with the melted butter and poppyseeds. Sprinkle over the top.
Bake at 350°F for 20–30 minutes.`),

R("Chicken Parmesan Casserole", { course: E, protein: "Chicken", cuisine: "Italian", tags: [CAS], cook: 40, credit: "Ashley Fields" }, `
2 tbsp olive oil
2 cloves garlic, crushed
1/4 cup fresh basil
1 cup shredded mozzarella cheese
1/4 cup shredded parmesan cheese
6 boneless skinless chicken breasts
1 jar tomato sauce
1 package croutons`, `
Brush the oil and garlic over a 9x13 pan.
Add the chicken and top with basil.
Pour the sauce over the chicken and add a bit more basil.
Top with the cheese, then the croutons.
Bake at 350°F for 35–45 minutes.`),

R("Philly Cheesesteak Stuffed Peppers", { course: E, protein: "Beef", cuisine: "American", tags: ["low carb"], cook: 30 }, `
8 oz thinly sliced roast beef
8 slices provolone cheese
2 large green bell peppers
1 medium sweet onion, sliced
6 oz mushrooms, sliced
2 tbsp butter
2 tbsp olive oil
1 tbsp minced garlic
Salt and pepper`, `
Preheat oven to 400°F. Slice the peppers in half lengthwise and remove the ribs and seeds.
In a large sauté pan over medium heat, cook the butter, olive oil, garlic, mushrooms, onion, salt and pepper until the onion and mushrooms are tender.
Slice the roast beef into thin strips and add to the pan. Cook 3–5 minutes until heated through.
Line the inside of each pepper with a slice of cheese, fill with the meat mixture and top with another slice.
Bake 15–20 minutes until the cheese on top is golden brown.`),

R("Roast", { course: E, protein: "Beef", cuisine: "American", tags: [CP], cook: 300, credit: "Toni Riess" }, `
Chuck roast
Salt, pepper and garlic, to taste
1 pkg onion soup mix
1 can cream of mushroom soup
Olive oil
Potatoes & carrots`, `
Add everything except the potatoes and carrots to the crockpot. Cook on low 5–6 hours.
Turn to high, add the potatoes and carrots, and cook on high until they're done.`),

R("Mozzarella Stuffed Chicken", { course: E, protein: "Chicken", cuisine: "Italian", tags: ["make ahead"], cook: 30 }, `
Chicken breasts
Chicken marinade
Mozzarella sticks`, `
Marinate the chicken overnight.
Pound the chicken thin, then roll it around a mozzarella stick.
Bake 30 minutes at 350°F.`),

R("Bean Soup", { course: E, protein: "Pork", cuisine: "American", tags: [SOUP, CP], cook: 360 }, `
1 bag bean soup mix (with seasoning packet)
1 ham steak, cubed
2 quarts water
Remaining ingredients listed on the back of the soup package`, `
Soak the beans 10 minutes, then rinse. Repeat twice.
Put the beans in the crockpot with the ham and 2 quarts of water.
Cook on high until boiling hard, then reduce to low. (If it isn't boiling hard, leave it on high.)
Cook 6 hours on high or 8 hours on low.
Two hours before it's done, add everything else except the seasoning packet.
Add the seasoning packet.`),

R("Garlic Mushroom Quinoa", { course: E, protein: "Vegetarian", cuisine: "American", tags: [Q30, "healthy"], total: 30, servings: "about 6" }, `
1 cup quinoa
1 tbsp olive oil
1 lb cremini mushrooms, thinly sliced
5 cloves garlic, minced
1/2 tsp dried thyme
Salt and pepper
2 tbsp grated parmesan (optional)`, `
Cook the quinoa in a large saucepan according to package directions and set aside.
Heat the olive oil in a large skillet over medium-high heat.
Add the mushrooms, garlic and thyme and cook, stirring occasionally, until tender, 3–4 minutes. Season with salt and pepper.
Stir in the quinoa until well combined.
Serve immediately, garnished with parmesan if you like.`),

R("Chicken and Baked Rice", { course: E, protein: "Chicken", cuisine: "American", tags: [CAS], cook: 75 }, `
4 boneless chicken breasts
1 cup raw rice (not Minute rice!)
1 can cream of chicken soup
2 soup cans of water
1 pkg dry onion soup mix
Butter, for the dish
Salt`, `
Grease a baking dish liberally with butter.
Put the rice in the dish and sprinkle the onion soup mix on top.
Mix the water and soup and add to the casserole.
Salt the chicken and place on top of the rice.
Bake 1 hour 15 minutes at 375°F.`),

R("Easy Chicken Enchiladas", { course: E, protein: "Chicken", cuisine: "Tex-Mex", tags: [CAS], cook: 30 }, `
2 tbsp butter or margarine
1/2 cup chopped onion
1 clove garlic
1/2 cup chopped ripe black olives, divided
1/2 cup chopped jalapeños or green chiles
1/2 cup sour cream
1 can cream of chicken soup
1 1/2 cups cubed cooked chicken
1 cup shredded cheddar cheese, divided
6 large or 8 small flour or corn tortillas
1/4 cup milk`, `
Melt the butter in a pan and sauté the onion and garlic until tender.
Add half the olives, the chiles, sour cream and soup. Set aside ¾ cup of this sauce.
Fold the chicken and ½ cup cheese into the rest.
Warm the tortillas. Fill with the chicken mixture and roll, placing them seam-down in an ungreased baking dish.
Stir the milk into the reserved sauce and spoon over the tortillas.
Bake 25–35 minutes at 350°F, or until bubbly.
Top with the remaining cheese and olives and serve.`),

R("Spinach Lasagna Roll Ups", { course: E, protein: "Vegetarian", cuisine: "Italian", tags: ["pasta"], cook: 25, servings: "6" }, `
12 uncooked lasagna noodles
2 eggs, lightly beaten
2 1/2 cups ricotta cheese
2 1/2 cups shredded part-skim mozzarella (10 oz)
1/2 cup grated parmesan cheese
1 (10 oz) package frozen chopped spinach, thawed and squeezed dry
1/4 tsp salt and pepper
1/4 tsp ground nutmeg
1 (26 oz) jar spaghetti sauce`, `
Cook the lasagna noodles according to package directions and drain.
Meanwhile, combine the eggs, cheeses, spinach, salt, pepper and nutmeg in a large bowl.
Spread ⅓ cup of the cheese mixture over each noodle and carefully roll up.
Pour 1 cup spaghetti sauce into the bottom of an ungreased 13x9 baking dish.
Place the roll-ups seam-side down over the sauce and top with the remaining sauce.
Bake uncovered at 375°F for 20–25 minutes, or until heated through.`),

R("Crockpot Shredded Beef Tacos", { course: E, protein: "Beef", cuisine: "Mexican", tags: [CP], cook: 300 }, `
1 (2.5 lb) chuck roast
1 (14 oz) can beef broth
1 1/2 tbsp chili powder
1/2 tbsp ground cumin
1/2 tbsp onion powder
1 tsp garlic powder
1 tsp salt
1/4 tsp pepper
Juice of 1 lime
Cooking spray
For serving:
Tortillas
Lettuce, tomato & cheese
Guacamole, sour cream & salsa`, `
Spray the crockpot with cooking spray and place the roast inside.
Pour the beef broth over the roast and squeeze the lime juice over it.
Whisk the seasonings together in a small bowl and sprinkle over the roast.
Cover and cook on low 8–10 hours or high 5–6 hours.
Transfer the roast to a platter, shred the meat and remove any fat.
Return the beef to the crockpot, cover and cook 30 more minutes.
Lift the beef out with tongs to drain the juices, and serve with tortillas and toppings.`),

R("Fried Rice", { course: E, protein: "Eggs", cuisine: "Asian", tags: [], total: 20 }, `
1 slab butter
1 cup Minute Rice
1 cup water
1 bouillon cube (per cup of water)
Mixed veggies (peas, corn)
1 egg`, `
Melt the butter in a pan and add as much rice as you're cooking. Pan-fry the rice over medium heat.
While the rice fries, heat the measured water with bouillon (1 cube per cup) in the microwave until boiling.
When the rice is done frying, add the veggies and the egg, scrambling it in the pan.
Add the boiling bouillon water and bring back to a boil.
Turn off the burner and leave the pan on it for 10 minutes (or follow package directions).`),

R("One-Pot Cajun Pasta", { course: E, protein: "Chicken", cuisine: "Cajun", tags: ["one pot", "pasta"], cook: 35, credit: FB }, `
2 tbsp olive oil
2 chicken breasts, diced (uncooked)
1 tbsp cajun seasoning
8 oz andouille sausage
3 cloves garlic
1/2 onion, sliced
1 red bell pepper, sliced
1 green bell pepper, sliced
2 cups mushrooms
1 lb linguine
5 cups chicken broth
1/2 cup heavy cream
1 cup parmesan cheese`, `
Heat the olive oil over medium-high heat. Add the chicken and cajun seasoning and cook through.
Remove the chicken, then brown the sausage over medium heat, about 5 minutes. Add the chicken back in.
Add the garlic, onion, peppers and mushrooms and cook until the onion is translucent.
Add the pasta and chicken broth, cover and bring to a boil.
Uncover and stir, then cover again and simmer 10 minutes, stirring every 2 minutes, until the pasta is cooked through.
Stir in the cream and parmesan. Serve and enjoy.`),

R("Teriyaki Chicken and Veggies", { course: E, protein: "Chicken", cuisine: "Asian", tags: [], cook: 25, credit: FB }, `
Sauce:
1/4 cup honey
2 tbsp minced ginger
1/3 cup water
1/3 cup soy sauce
4 tbsp cornstarch
Chicken & veggies:
1 tbsp olive oil
1 1/2 lb chicken thighs, chopped
Salt and pepper
2 cloves garlic, minced
3 large carrots
Pinch of chili flakes
8 oz broccoli florets, steamed`, `
Add the honey, ginger, water, soy sauce and cornstarch to a medium saucepan over medium heat. Cook 5 minutes, then remove from heat and set aside.
In a large sauté pan, cook the chicken in the oil with salt and pepper until done.
Add the garlic, carrots, sauce, chili flakes and steamed broccoli. Stir and simmer 5 minutes.
Serve and enjoy.`),

R("Crockpot Honey Garlic Chicken & Veg", { course: E, protein: "Chicken", cuisine: "Asian", tags: [CP], cook: 180, credit: FB }, `
1 lb red potatoes, cubed
1 lb whole carrots
1 1/2 lb bone-in chicken thighs
Salt and pepper
Sauce:
1/2 cup honey
1/2 cup soy sauce
8 cloves garlic
1 1/2 tsp dried basil
1/2 tsp black pepper
1/2 tsp chili flakes
Last 30 minutes:
1/2 lb whole green beans`, `
Add the potatoes, carrots and half the chicken to the crockpot and sprinkle with salt and pepper.
In a bowl, stir together the honey, garlic, soy sauce, basil, pepper and chili flakes.
Pour half the sauce over the crockpot, add the rest of the chicken and pour the remaining sauce over the top.
Cook on high 3–4 hours. Add the green beans for the last 30 minutes.
Serve with sauce from the bottom of the crockpot drizzled over the top.`),

R("No-Bread BLTs", { course: E, protein: "Pork", cuisine: "American", tags: ["low carb", "no-cook"] }, `
Whole romaine lettuce leaves
Bacon slices, cooked
Cherry tomatoes, halved
Mayo
Salt and pepper`, `
Spread mayo on the lettuce leaves and sprinkle the tomatoes over the top.
Lay a slice of cooked bacon inside and sprinkle with salt and pepper.
Fold over like a taco to eat!`),

R("Korean Beef Bowls", { course: E, protein: "Beef", cuisine: "Korean", tags: ["15-minute meal"], total: 15 }, `
1/3 cup packed brown sugar
1/4 cup soy sauce
1 tbsp sesame oil
1/2 tsp crushed red pepper flakes (or more to taste)
1/4 tsp ground ginger
1 tbsp vegetable oil
3 cloves garlic, minced
1 lb ground beef
2 green onions, thinly sliced
Cooked rice, for serving`, `
Boil water for the rice.
In a small bowl, whisk together the brown sugar, soy sauce, sesame oil, red pepper flakes and ginger.
Heat the vegetable oil in a large skillet over medium-high heat. Add the garlic and cook, stirring constantly, until fragrant, about 1 minute.
Add the ground beef and cook until browned. Drain the excess fat.
Stir in the soy sauce mixture and green onions and simmer until heated through, about 2 minutes.
Serve immediately over rice.`),

R("Meat Loaf", { course: E, protein: "Beef", cuisine: "American", tags: [], cook: 90, servings: "6" }, `
Meat loaf:
1 1/2 lb ground beef
1 cup cracker crumbs
2 eggs, beaten
1/2 cup chopped onion
2 tbsp chopped green pepper
1 1/2 tsp salt
2 tbsp Worcestershire sauce
1 (8 oz) can tomato sauce
Sauce:
1/2 cup ketchup
1/3 cup brown sugar
1 1/2 tbsp Worcestershire sauce
1/2 tsp mustard`, `
Mix the meat loaf ingredients in the order given and shape into a loaf.
Bake in a 1½-quart loaf pan for 1¼ hours at 350°F.
Drain, then pour the sauce over the top.
Return to the oven for 15 minutes.`),

R("Fajita Chicken Burrito Bowls", { course: E, protein: "Chicken", cuisine: "Tex-Mex", tags: ["sheet pan"], cook: 25 }, `
3–4 chicken breasts
Bell peppers, sliced
Onion, sliced
Salt and pepper
Olive oil
1 tbsp taco seasoning
1 jar salsa
Fresh cilantro (optional)
For the bowls:
Minute rice
Black beans
Corn`, `
Line a baking sheet with foil and arrange the peppers, chicken and onion on it.
Drizzle with olive oil and sprinkle with salt and pepper.
Sprinkle the taco seasoning over the chicken, then pour the salsa over the chicken.
Bake at 400°F for 25 minutes.
While the chicken bakes, cook the rice and heat the black beans and corn.
Slice the chicken. Build bowls with rice, beans, corn, salsa, peppers, onion and chicken, topped with salt, pepper and fresh cilantro.`),

R("Garlic Parmesan Chicken and Vegetables", { course: E, protein: "Chicken", cuisine: "American", tags: ["sheet pan", ONE], cook: 25 }, `
1–2 heads broccoli
4–5 red potatoes
2–3 chicken breasts
Olive oil
Sea salt
Pepper
Onion powder
Paprika
2 cloves garlic
1/3 cup parmesan`, `
Cut the broccoli and potatoes into bite-size pieces.
Line a baking sheet with the broccoli, potatoes and raw chicken.
Drizzle with olive oil and sprinkle with sea salt, pepper, onion powder and paprika, flipping the chicken to season both sides. Toss together with your fingers.
Add the garlic to the chicken, then sprinkle parmesan over everything.
Bake at 400°F for 20–25 minutes, until fully cooked.`),

R("Cowboy Stew", { course: E, protein: "Beef", cuisine: "Tex-Mex", tags: [SOUP] }, `
1–1 1/2 lb ground beef
1 onion, chopped
1 can tomato soup
2 cans diced potatoes
2 cans green beans
1 can diced tomatoes
1 can mild chopped green chiles
2 cans ranch style beans
1 can corn
Salt and pepper, to taste`, `
Brown the meat and chopped onion in a pot.
Add all the cans — do NOT drain! Add a cup or two of water if needed.
Cook until boiling.`),

R("Sautéed Cabbage and Chicken", { course: E, protein: "Chicken", cuisine: "", tags: ["low carb"], cook: 65 }, `
3 tbsp olive oil
1/2 lb boneless chicken thighs, cut in small pieces
1 small cabbage
2 medium carrots, shredded
1 tbsp paprika
2 tomatoes
3 bay leaves
1 cup chicken stock
Salt and pepper
Chopped fresh parsley`, `
Warm a large sauté pan over medium-high heat. Add the olive oil and chicken and fry 5–7 minutes, or until browned.
Meanwhile, slice the cabbage into thin strips, like you would for coleslaw.
Add the cabbage and paprika to the chicken, stir and sauté another 5–10 minutes.
Purée the tomatoes in a small food chopper or food processor.
Add the tomato, chicken stock, carrots and bay leaves, season with salt and pepper, and stir everything together.
Reduce heat to low and cook about 45 minutes, stirring occasionally, until no liquid remains.
Garnish with fresh parsley.`),

R("Sweet Potato Chili", { course: E, protein: "Turkey", cuisine: "Tex-Mex", tags: [SOUP, "healthy"], cook: 35 }, `
20 oz 93% lean ground turkey or beef
Kosher salt, to taste
1/2 cup chopped onion
3 cloves garlic, crushed
1 (10 oz) can Rotel mild tomatoes with green chilies
1 (8 oz) can tomato sauce
Canned beans (optional)
3/4 cup water
1/2 tsp cumin, or to taste
1/4 tsp chili powder
1/4 tsp paprika
1 bay leaf
1 medium sweet potato, diced into ½-inch cubes
Fresh cilantro, for garnish`, `
In a large skillet, brown the turkey over medium-high heat, breaking it into small pieces, and season with salt and cumin.
When the meat is cooked through, add the onion and garlic and cook 3 minutes over medium heat.
Add the Rotel, sweet potato, tomato sauce, beans, water, cumin, chili powder, paprika, salt and bay leaf.
Cover and simmer over medium-low heat about 25 minutes, stirring occasionally, until the potatoes are soft. Add ¼ cup more water if needed.
Remove the bay leaf and serve, garnished with cilantro.`),

R("Eckert Casserole", { course: E, protein: "Pork", cuisine: "American", tags: ["breakfast", CAS], cook: 60,
  notes: "Start with ¾ cup milk; if it's too thick, add the rest. Go heavier rather than lighter on the garlic and onion powder. Other cheeses work too." }, `
9 slices buttered bread, cubed
12 eggs
1 lb sausage, cooked and crumbled
1 cup shredded Colby Jack cheese
3/4–1 cup milk
1/4 tsp dry mustard
Pepper
Garlic and onion powder, to taste (about 1 tsp)`, `
Combine the bread, sausage and cheese in a greased baking dish.
Whisk the eggs, milk, dry mustard, pepper, and garlic and onion powder, and pour over the top.
Cover with foil and bake at 350°F for 45 minutes.
Remove the foil and bake until the center isn't liquidy, about 10–15 minutes more.`),

R("Crockpot Shredded Chicken Tacos", { course: E, protein: "Chicken", cuisine: "Tex-Mex", tags: [CP], cook: 180, notes: "Usually enough for 2 dinners." }, `
1 1/2–2 lb chicken breasts or tenders
1 pkg taco seasoning
1 pkg dry ranch mix
1 (24 oz) jar salsa (whatever's on sale)
A few fresh limes`, `
Put the chicken in the crockpot.
Sprinkle with the taco seasoning and ranch mix.
Pour the salsa over the chicken and cover.
Cook on high 3–4 hours or low 6–8 hours.
Remove the chicken, shred it and return it to the crockpot.
Squeeze in a few fresh limes and stir before serving.`),

R("One-Pan Cheesy Sausage Pasta", { course: E, protein: "Pork", cuisine: "American", tags: [ONE, "pasta"], cook: 25 }, `
1 tbsp olive oil
1 (14 oz) package Klement's Polish sausage, sliced into ¼-inch pieces
1 small onion, finely chopped
2 cloves garlic, minced
1 (14 oz) can fire-roasted tomatoes
8 oz short pasta (penne, rotini, etc.)
2 cups chicken stock
1/2 cup milk
1 cup shredded cheddar cheese
Green onions, finely chopped, for garnish`, `
Heat a large skillet over medium-high heat and add the oil, swirling to coat.
Add the sausage and onion and cook 5–7 minutes, stirring occasionally, until the onion is soft and the sausage starts to brown.
Add the garlic and cook 1 minute.
Stir in the tomatoes, pasta, chicken stock and milk and bring to a boil.
Reduce heat, cover and cook 10–12 minutes until the pasta is done.
Stir in the cheddar until melted. Garnish with green onions.`),

R("Crockpot Gumbo", { course: E, protein: "Chicken", cuisine: "Cajun", tags: [CP, SOUP], cook: 180 }, `
2 lb chicken breasts or thighs
1 lb sausage
1 bell pepper, diced
1 onion, diced
2 celery stalks, sliced
4 cloves garlic
2 bay leaves
1–2 cups frozen okra
1 can chicken broth
6 oz tomato paste
15 oz diced tomatoes
4 tsp cajun seasoning (1 tbsp + 1 tsp)
1/2 tsp pepper
1/2 tsp cayenne
1/2 tsp thyme
1/2 tsp oregano
Rice, for serving`, `
Add everything except the okra and sausage to the slow cooker and stir well.
Cook on high 3–4 hours or low 6–7 hours. Halfway through, add the okra and sausage.
When done, shred the chicken and return it to the crockpot.
Remove the bay leaves and serve over rice. Keep warm until ready to serve.`),

R("Tomato Basil Chicken Pasta", { course: E, protein: "Chicken", cuisine: "Italian", tags: [CAS, "pasta"], cook: 50 }, `
2 cups grilled chicken, cut into bite-size pieces
2 cups grape tomatoes, halved
3 cups uncooked penne pasta
3 1/2 cups low-sodium chicken broth
1 1/2 cups shredded mozzarella cheese, divided
1/2 cup chopped fresh basil, divided
1 tsp minced garlic
Salt and pepper, to taste
Cooking spray`, `
Preheat oven to 450°F and spray a 9x13 baking dish with cooking spray.
Add the chicken, tomatoes, pasta, broth, 1 cup cheese, ¼ cup basil, garlic and salt to the dish and mix.
Cover with foil and bake 40 minutes.
Remove the foil, top with the rest of the cheese and bake uncovered 5–10 minutes more, until melted.
Garnish with the remaining basil.`),

R("Breakfast Cheese Grits", { course: E, protein: "Eggs", cuisine: "Southern", tags: ["breakfast"], cook: 15 }, `
2 tbsp butter
2 cloves garlic, minced
3 1/2 cups reduced-sodium chicken broth
1 1/3 cups milk
1/2 tsp black pepper
1 1/4 cups quick-cooking grits
1 cup shredded white cheddar cheese
1 cup shredded smoked Gouda cheese
Toppings (optional):
Fried eggs
Bacon, crumbled`, `
In a large saucepan, heat the butter over medium. Add the garlic and cook, stirring, 2 minutes.
Stir in the chicken broth, milk and pepper and bring to a simmer.
Add the grits in a steady stream, stirring constantly. Reduce heat to medium-low.
Cook and stir 6–8 minutes, or until thickened. Stir in the cheeses until melted.
If you like, top with a fried egg and bacon, or stir crumbled bacon into the grits for texture.`),

R("White Bean Chicken Chili", { course: E, protein: "Chicken", cuisine: "Tex-Mex", tags: [CP, SOUP], cook: 300 }, `
3–4 chicken breasts
2 (4.5 oz) cans diced green chiles
1 small yellow onion, diced
2–3 celery stalks, diced
3–4 small cloves garlic, minced
1 bay leaf
1 tsp cumin
1 tsp fine sea salt
32 oz low-sodium chicken broth
1 (15 oz) can corn (or 1–2 cups frozen)
1 (15 oz) can cannellini beans
For serving:
Chopped cilantro
Avocado slices
Jalapeños
Plain Greek yogurt
Tortilla chips`, `
Add everything except the corn and beans to the crockpot, stir and cover.
Cook on low 5–6 hours or on high 4 hours.
Stir in the drained and rinsed corn and beans. Cover and cook another 30 minutes to 1 hour.
Remove the chicken and shred it. Remove the bay leaf.
Return the chicken to the chili, stir, and add salt and pepper to taste.
Eat it as is, or serve with cilantro, avocado, jalapeños, a scoop of Greek yogurt and tortilla chips.`),

R("Egg Roll in a Bowl", { course: E, protein: "Pork", cuisine: "Asian", tags: [Q30, "low carb"], total: 20 }, `
1 roll sausage
3 eggs
1/2 package coleslaw mix
Sesame oil
Ground ginger, garlic powder and onion powder
Asian-style noodles or rice, for serving
Spicy mayo, sriracha or bang bang sauce, for topping`, `
Cook the sausage in sesame oil.
Scramble the eggs.
Sauté the coleslaw mix in sesame oil.
Season with ginger, garlic and onion powder.
Serve with Asian-style noodles or rice, topped with spicy mayo, sriracha or bang bang sauce.`),

R("Homemade Hamburger Helper", { course: E, protein: "Beef", cuisine: "American", tags: ["one pot", "pasta", "kid friendly"], cook: 25,
  notes: "For dairy-free, use 4 cups beef broth and skip the milk." }, `
2 tbsp olive oil
1/2 yellow onion, finely diced
1 lb ground beef
1 tsp kosher salt
1/2 tsp black pepper
1/2 tsp garlic powder
1/2 tsp paprika
1 tbsp tomato paste
12 oz dried elbow pasta
2 cups beef broth
2 cups milk
1 cup shredded cheese
1/4 cup chopped fresh parsley (optional)`, `
Heat a very large skillet or pot over medium-high heat. Add the olive oil, onion and ground beef.
Season with salt, pepper, garlic powder and paprika and sauté until the beef is cooked through.
Stir in the tomato paste.
Add the dry pasta, beef broth and milk. Stir and cook until the pasta is tender and the liquid is absorbed, about as long as the pasta box says.
Remove from heat, add the cheese and stir to combine.`),

R("Sausage Tortellini Soup", { course: E, protein: "Pork", cuisine: "Italian", tags: [CP, SOUP, "pasta"], cook: 270,
  notes: "Add a second can of tomatoes if you really love tomatoes!" }, `
1 lb Italian sausage, browned, drained and chopped
1–2 (15 oz) cans Italian diced tomatoes
4 cups vegetable or chicken broth (32 oz)
8 oz cream cheese, cubed
1 (20 oz) bag frozen cheese tortellini
3–4 cups fresh spinach
1 tbsp garlic salt
1 tbsp onion powder
1 tbsp Italian seasoning
1/2 tbsp black pepper`, `
Add the sausage, broth, tomatoes, cream cheese and seasonings to the slow cooker and stir well.
Cook on low 4 hours, or until the cream cheese has completely melted.
Stir in the spinach and frozen tortellini and cook 30 more minutes, until the pasta is done to your liking.
Once it's cooked, turn the crockpot off instead of leaving it on warm.`),

R("Cheesy Potato Soup", { course: E, protein: "", cuisine: "American", tags: [SOUP], cook: 30 }, `
6 cups sliced potatoes
2 cups water
1 cup sliced celery
1 cup sliced carrots
1/2 cup chopped onion
2 tsp parsley flakes
2 chicken bouillon cubes
1 tsp salt
1/4 tsp pepper
3 cups milk
4 tbsp flour
1 lb Velveeta, cubed (half of a 2 lb block)`, `
In a large saucepan, combine the potatoes, water, celery, carrots, onion, parsley flakes, bouillon and seasonings, with enough water to cover the potatoes.
Cover and simmer 15–20 minutes, or until the vegetables are tender.
Gradually whisk the milk into the flour, then add to the vegetables and cook until thickened.
Add the Velveeta and stir until melted.`),

R("Balsamic Pasta Salad", { course: E, protein: "", cuisine: "Mediterranean", tags: ["pasta", "cold", "make ahead"] }, `
Salad:
1/2 box pasta, cooked and cooled
Red onion, chopped
1 bell pepper, chopped
Cucumber, chopped
Cheese, chopped (sliced provolone or Muenster)
Thick-sliced ham or chicken lunch meat, chopped
1 can chickpeas, drained and rinsed
1 can black beans, drained and rinsed
Avocado
Dressing:
1/2 cup olive oil
1/4 cup balsamic vinegar
2 cloves garlic
Cumin and oregano
Salt and pepper`, `
Mix the dressing ingredients together.
Combine the salad ingredients, pour the dressing over and toss!`),

R("Esquites Beef Bowls", { course: E, protein: "Beef", cuisine: "Mexican", tags: [] }, `
Esquites:
1 can sweet corn
1–2 jalapeños, chopped
Cilantro
Avocado, diced
1 cup cottage cheese
1 dollop mayo
Juice of about 4 limes
Cotija cheese
Salt
Tajín
Bowls:
Ground taco meat
Air-fried sweet potatoes
Refried beans
Toppings:
Hot honey & hot sauce
Tortilla chips`, `
Combine the corn, chopped jalapeños, cilantro and diced avocado in a bowl.
Blend the cottage cheese and mayo in a food processor and stir into the corn mixture.
Add lime juice (to taste) and salt, then cotija and lots of Tajín.
Prepare the taco meat and air-fried sweet potatoes, and heat the beans.
Layer the potatoes, beans and beef, then top with the esquites.
Add toppings and eat with chips!`),

// ============================================================ SIDES & APPETIZERS
R("Brussels Sprouts Polonaise", { course: S, protein: "Vegetarian", cuisine: "", tags: [], cook: 20 }, `
1 lb Brussels sprouts
2 tbsp butter
1/4 cup fine dry bread crumbs
1 hard-cooked egg, finely chopped
2 tbsp snipped parsley`, `
Cut any large sprouts in half.
Cook covered in boiling salted water 10–15 minutes, or until tender. Drain.
Heat the butter until lightly browned, then blend in the crumbs, egg and parsley.
Spoon over the sprouts and toss lightly.`),

R("Green Bean Casserole", { course: S, protein: "Vegetarian", cuisine: "American", tags: [CAS, "holiday"],
  notes: "The oven temperature wasn't written on the original card." }, `
2–3 cans green beans
1 can cream of mushroom soup
1/3–1/2 can milk
Fried onions`, `
Add the beans, soup and milk to a baking dish and stir.
Bake until bubbling.
Top with fried onions and return to the oven to brown for 10 more minutes.`),

R("Orzo Pasta Salad", { course: S, protein: "", cuisine: "Mediterranean", tags: ["pasta", "cold"], credit: "Jordan Miller" }, `
Dressing:
1/4 cup red wine vinegar
2 tbsp fresh lemon juice
1 tsp honey
1/2 cup olive oil
Salt and pepper
Salad:
6 cups chicken broth
1 lb orzo
2 cups red or yellow grape tomatoes, halved
7 oz feta cheese, cubed
1 cup basil
1 cup chopped green onions
1/2 cup toasted pine nuts`, `
Whisk the vinegar, lemon juice and honey, then gradually whisk in the oil. Season with salt and pepper.
Bring the broth to a boil and stir in the orzo. Reduce heat to medium, partially cover and cook until tender.
Drain and cool.
Mix in the remaining ingredients (except the pine nuts) and toss with the dressing to coat.
Add the pine nuts last.`),

R("Sausage Gravy", { course: S, protein: "Pork", cuisine: "Southern", tags: ["breakfast"], cook: 20 }, `
1 lb breakfast sausage
1/3 cup all-purpose flour
3–4 cups whole milk
1/2 tsp seasoned salt
2 tsp black pepper (or more)
Warm biscuits, for serving`, `
Brown the sausage, then reduce heat to medium-low.
Sprinkle in half the flour and stir so the sausage soaks it up, then add the rest little by little.
Pour in the milk and stir occasionally until thickened. If it gets too thick, add more milk.
Sprinkle in the seasonings and adjust to taste. Serve over warm biscuits.`),

R("Mandarin Orange Jello", { course: S, protein: "", cuisine: "American", tags: ["no-bake", "make ahead"], credit: "Jill Eckert" }, `
2 small boxes apricot Jell-O
1 (24 oz) container small-curd cottage cheese, drained
1 (8 oz) container Cool Whip
1 large can mandarin oranges, drained`, `
Mix the Jell-O powder and cottage cheese until combined.
Add the drained mandarin oranges.
Fold in the Cool Whip.`),

R("Spicy Seasoned Pretzels", { course: A, protein: "", cuisine: "", tags: ["snack", "make ahead", "party"],
  notes: "Oven option: bake at 200°F for 1 hour, stirring several times for even baking, then let cool." }, `
1 (16 oz) bag tiny twist pretzels
1 cup vegetable or canola oil
2 tsp garlic salt (or 1 tsp garlic powder + 1 tsp salt)
2 tsp lemon pepper
1 tsp cayenne pepper`, `
Pour the oil and spices into a gallon Ziploc bag. Seal and shake to combine.
Add the pretzels, seal the bag and gently shake to coat.
Let soak at least 6 hours (24 hours is best), turning and shaking the bag every few hours.`),

R("Gazpacho", { course: S, protein: "Vegetarian", cuisine: "Spanish", tags: [SOUP, "cold", "make ahead"], credit: "Michelle Tedder" }, `
3 fresh tomatoes, diced
5 cucumbers, peeled and diced
1 green bell pepper, diced
2 cloves garlic, minced
Dressing:
6 tbsp vinegar
3 tsp salt
1 tsp sugar`, `
Combine the vegetables and dressing.
Chill overnight and stir before serving.`),

R("Cheesy Pigs in Bacon Blankets", { course: A, protein: "Pork", cuisine: "American", tags: ["party", "kid friendly"], cook: 14, servings: "8", credit: "Justine Hala" }, `
1 pkg Pillsbury crescent rolls (red, fat)
4 wedges Laughing Cow Swiss cheese
Garlic powder
8 hot dogs
1/4 cup precooked crumbled bacon
Optional dips:
Hellmann's Dijonnaise
Ketchup, salsa or honey mustard`, `
Preheat oven to 375°F and spray a baking sheet with nonstick spray.
Stretch out one crescent triangle, sprinkle with a dash of garlic powder, add a hot dog and roll up, squeezing the dough to hold it in.
Sprinkle about ½ tbsp bacon on top and place on the baking sheet. Repeat with the other hot dogs.
Bake until lightly browned, 12–14 minutes.
Cool slightly and serve with the dips.`),

R("Hard Boiled Eggs", { course: S, protein: "Eggs", cuisine: "", tags: ["snack"], cook: 20 }, `
Eggs
Cold water
Ice cubes`, `
Place the eggs in a saucepan with cold water ½ inch above the eggs.
Heat on high until it reaches a rolling boil.
Reduce to medium-high for a soft boil and cook 10 minutes.
Turn off the heat and let it stop bubbling.
Drain and refill with cold water and ice cubes, three times.`),

R("Spinach Dip", { course: A, protein: "Vegetarian", cuisine: "", tags: ["no-cook", "party"], credit: "Kelsy Vorderlandwher" }, `
1 packet Knorr dry vegetable soup mix
10 oz frozen spinach, thawed
8 oz water chestnuts, chopped
8 oz light sour cream
8 oz low-fat plain Greek yogurt
Crackers, for serving`, `
Mix all the ingredients and serve with crackers.`),

R("Queso", { course: A, protein: "Pork", cuisine: "Tex-Mex", tags: [CP, "party"], cook: 60 }, `
1 lb sausage
1 (1 lb) block Velveeta
1 can Rotel tomatoes
Tortilla chips, for serving`, `
Cook the sausage on the stove until fully cooked.
Cut the Velveeta into small cubes.
Place everything in the crockpot and heat on high 45 minutes, or until melted.
Serve with chips.`),

R("Zucchini Chips", { course: A, protein: "Vegetarian", cuisine: "", tags: ["snack", "healthy"], cook: 120 }, `
Zucchini
Canola oil spray
Olive oil
Salt, cayenne pepper, seasoned salt, pepper, etc.`, `
Slice the zucchini on the thinnest mandoline setting.
Dry thoroughly with paper towels and let sit for a bit.
Line a cookie sheet with foil and spray with canola oil.
Lay the slices in a single layer and brush with a light coat of olive oil.
Season with salt, cayenne, seasoned salt, pepper, etc.
Bake at 225°F for 2 hours, until golden brown.`),

// ============================================================ DESSERTS
R("Party Popcorn", { course: D, protein: "", cuisine: "", tags: ["no-bake", "party", "kid friendly"] }, `
6–7 oz white candy melts (vanilla CandiQuik works best)
1 large package lightly salted popcorn, popped (Orville Redenbacher's Simply Salted recommended)
Sprinkles`, `
Melt the candy melts and gently mix with the popped popcorn.
Add sprinkles before the chocolate sets!
Refrigerate until hardened.`),

R("Gooey S'mores Bars", { course: D, protein: "", cuisine: "", tags: ["kid friendly"], cook: 21 }, `
1 (14.5 oz) package refrigerated chocolate chip cookie dough
5 graham crackers, crushed
4 milk chocolate candy bars
1 1/2 cups mini marshmallows`, `
Preheat oven to 375°F. Let the cookie dough sit out in a large bowl for 20 minutes.
Mix in the crushed graham crackers until well combined.
Spread evenly into an 8x8 glass pan and bake 15 minutes.
Remove and immediately lay the chocolate bars across the top.
Sprinkle with marshmallows and bake 5 minutes more.
Broil 1 minute to toast the marshmallows. Cool before cutting.`),

R("Cherry Dessert", { course: D, protein: "", cuisine: "", tags: [], cook: 60 }, `
1 (21 oz) can cherry pie filling
1 (20 oz) can crushed pineapple, undrained
1 box yellow cake mix, sifted
1 cup chopped nuts
1 cup butter, melted
Whipped cream, for serving (optional)`, `
Spread the cherry filling in a greased 13x9x2 baking dish.
Cover with the pineapple and sprinkle with the cake mix.
Add the nuts and pour the melted butter over everything.
Bake in a preheated 350°F oven for 1 hour.
Serve with whipped cream or topping if you like.`),

R("Pumpkin Bread", { course: D, protein: "", cuisine: "", tags: ["fall", "holiday"], cook: 60, servings: "3 loaves" }, `
3 1/2 cups flour
2 tsp baking soda
1 1/2 tsp salt
1 tsp cinnamon
1 tsp nutmeg
3 cups sugar
1 cup oil
4 eggs
2/3 cup water
2 cups pumpkin purée (or one 16 oz can)
1/2–1 cup pecans or walnuts (optional)`, `
Sift the dry ingredients into a bowl.
Make a well in the center and add the remaining ingredients. Mix until smooth.
Divide into 3 greased and floured loaf pans (or disposable foil pans).
Bake about 1 hour at 350°F.
Cool slightly, then remove from the pans and cool on a rack.`),

R("Chocolate Chip Ooey Gooey Butter Cake", { course: D, protein: "", cuisine: "", tags: [], cook: 50 }, `
Crust:
1 box butter-recipe cake mix
1 egg
1/2 cup butter (1 stick), melted
Filling:
1 (8 oz) package cream cheese, softened
2 eggs
1 tsp pure vanilla extract
1 (16 oz) box powdered sugar
1/2 cup butter (1 stick), melted
1 cup chocolate chips (mini are best)`, `
Preheat oven to 350°F and lightly grease a 9x13 pan.
With an electric mixer, combine the cake mix, egg and melted butter. Pat into the bottom of the pan and set aside.
Beat the cream cheese until smooth, then add the eggs and vanilla.
Add the powdered sugar and beat very well.
Reduce the mixer speed and slowly pour in the melted butter. Mix well, then stir in the chocolate chips.
Pour the filling over the crust and spread evenly.
Bake 40–50 minutes (usually closer to 50). You want the center a little gooey, so don't overbake!
Cool completely. To drizzle with melted chocolate, cool at least 15 minutes first, then let it set another hour before cutting into bars.`),

R("Peanut Butter Pie", { course: D, protein: "", cuisine: "", tags: ["no-bake"] }, `
Crust (or use a premade Oreo crust):
1 package Oreos
1 stick butter, melted
Filling:
1 stick butter, softened
1 1/2 cups creamy peanut butter
1 cup powdered sugar
Chocolate layer:
1 cup chocolate chips
2 tbsp creamy peanut butter
1/2 cup heavy whipping cream`, `
Finely crush the Oreos in a food processor, blender or Ziploc bag. Stir the crumbs with the melted butter until well combined.
Press into the bottom and sides of a pie pan and freeze 10 minutes until set (or use a premade Oreo crust).
Beat the softened butter, peanut butter and powdered sugar on low until smooth and creamy.
Spread over the crust in a smooth layer and return to the freezer.
Put the chocolate chips and the 2 tbsp peanut butter in a heat-proof bowl.
Bring the cream to a rolling simmer in a saucepan over medium-high heat. Pour it over the chocolate, let sit 5 minutes, then whisk until completely smooth.
Pour the chocolate layer over the peanut butter layer.
Cover and refrigerate at least 1 hour, until ready to serve.`),

R("Cake in a Mug", { course: D, protein: "", cuisine: "", tags: ["microwave", "kid friendly"], total: 10, servings: "4 (8 oz mugs)" }, `
3 eggs
1/2 cup sugar
1/2 cup flour
1 tsp salt
8 tbsp butter
2/3 cup chocolate chips
Whipped cream, for topping`, `
Whisk the eggs in a medium bowl, then whisk in the sugar. Add the flour and salt.
Microwave the butter and chocolate chips 30 seconds, stir, and microwave 30 seconds more. Stir into the batter.
Fill each mug halfway and microwave one at a time for 1–2 minutes.
Let cool 3 minutes and top with whipped cream.`),

R("Peppermint Brittle", { course: D, protein: "", cuisine: "", tags: ["holiday", "no-bake"] }, `
3 (11 oz) bags white chocolate chips
12 large peppermint candy canes`, `
Crush the candy canes in a plastic bag with a rolling pin.
Make a double boiler with a metal bowl over a pot of simmering water. Melt the white chocolate chips, stirring until smooth.
Line an 11x17 baking sheet with wax paper and spread the chocolate evenly over it.
Top with the crushed candy canes.
Refrigerate until set, about 1 hour. Break into pieces and serve.`),

R("Chocolate Chip Cookies", { course: D, protein: "", cuisine: "", tags: ["cookies"], cook: 11, credit: "Kim Falk" }, `
1 cup butter, melted
1 cup sugar
1 cup brown sugar
1 tsp vanilla
2 eggs
1 tsp salt
1 tsp baking soda
3 cups flour
1 (12 oz) package chocolate chips
1 cup chopped nuts (optional)`, `
Preheat oven to 350°F.
In a large bowl, mix the melted butter, sugar, brown sugar, vanilla and eggs.
Add the salt and baking soda, then the flour. Mix well.
Stir in the chocolate chips and nuts.
Bake at 350°F for 11 minutes. Let cool 2 minutes.`),

R("Chocolate Chip Supreme Cookies", { course: D, protein: "", cuisine: "", tags: ["cookies"], cook: 12, credit: "Meg Milner" }, `
1/2 cup shortening
1/2 cup butter, softened
3/4 cup firmly packed dark brown sugar
3/4 cup granulated sugar
2 large eggs
1 (3.4 oz) package vanilla instant pudding mix
1 tbsp vanilla extract
2 1/4 cups all-purpose flour
1 tbsp baking soda
1 tsp ground cinnamon
1/2 tsp ground nutmeg
1/2 tsp salt
1 (12 oz) package semisweet chocolate morsels
1 1/2 cups chopped pecans
1 cup uncooked quick-cooking oats`, `
Beat the shortening and butter at medium speed until creamy. Gradually add the sugars, beating well.
Add the eggs, beating until blended. Add the pudding mix and vanilla and beat until blended.
Combine the flour, baking soda, cinnamon, nutmeg and salt. Gradually add to the butter mixture, beating until blended.
Stir in the chocolate morsels, pecans and oats.
Shape into 1½-inch balls, place on lightly greased baking sheets and press to 1-inch thickness.
Bake at 375°F for 10–12 minutes. Cool on wire racks.`),

R("Barb-aritas", { course: "Drink", protein: "", cuisine: "Mexican", tags: ["cocktail", "party"],
  notes: "Alternate version: mix fresh lime juice with an equal amount of tequila, 4 times as much water, a splash of triple sec and Splenda to taste." }, `
1 (12 oz) can frozen limeade
3 1/3 cans cold water
1 can tequila (use the limeade can)
2 shots triple sec
Salt and limes, for serving`, `
Mix together and store in the fridge.
Serve with salt and limes.`),

R("Pumpkin Dump Cake", { course: D, protein: "", cuisine: "", tags: ["fall", "holiday"], cook: 50 }, `
1 (15 oz) can pumpkin purée
10 oz evaporated milk
1 cup brown sugar
3 eggs
3 tsp pumpkin pie spice
1 box yellow cake mix
1 cup graham crackers, crushed
1/2 cup toffee pieces (such as Heath)
1 cup butter, melted
Ice cream or whipped cream, for serving`, `
Preheat oven to 350°F and spray a 9x13 baking pan.
Stir together the pumpkin, evaporated milk, brown sugar, eggs and pumpkin spice. Pour into the pan.
Sprinkle with the cake mix, then the graham crackers and toffee.
Pour the melted butter evenly over the top.
Bake 45–50 minutes, until the center is set and the edges are browned.
Serve with ice cream or whipped cream.`),

R("Cake Batter Blondies", { course: D, protein: "", cuisine: "", tags: ["kid friendly"], cook: 30 }, `
1 box yellow or vanilla cake mix
1/4 cup vegetable or canola oil
1 large egg
1/3–1/2 cup milk (less is better)
1/2 cup sprinkles
1/2 cup white chocolate chips (not regular chocolate — it turns the batter brown!)`, `
Preheat oven to 350°F and spray an 11x7 baking pan with nonstick spray.
Combine the cake mix, oil and egg in a large bowl, then add the milk slowly. You want the batter as dense and thick as possible!
Mix in the sprinkles and white chocolate chips.
Pour into the pan, top with a few more sprinkles and bake 25–30 minutes, until the edges are just turning brown.
Cool at least 30 minutes so the center sets before cutting into squares.`),

R("Brownie Batter Dip", { course: D, protein: "", cuisine: "", tags: ["no-bake", "party"] }, `
1 (8 oz) package cream cheese, softened
8 oz Cool Whip
1 (18 oz) box brownie mix, dry
2 tbsp milk
1 cup mini chocolate chips
For dipping:
Graham crackers & Nilla wafers
Pretzels
Chopped fruit`, `
In a large bowl, beat the cream cheese with a hand mixer until smooth. Mix in the Cool Whip until smooth.
Add the brownie mix and milk and mix until smooth.
Fold in the chocolate chips, saving a few for garnish.
Serve immediately, or cover and refrigerate up to one day ahead.`),

R("Ooey Gooey Butter Cake", { course: D, protein: "", cuisine: "", tags: [], cook: 35, credit: "Grandma Great" }, `
Cake:
1 box yellow cake mix
1/2 cup margarine, melted
1 egg, slightly beaten
Topping:
1 (8 oz) package cream cheese, softened
1 lb box powdered sugar (plus extra for dusting)
2 eggs`, `
Mix the cake ingredients together and press into a 13x9 pan, bringing it partway up the sides.
Beat the topping ingredients until smooth and spread over the top.
Bake 35 minutes at 350°F.
Sprinkle with powdered sugar after baking.`),

R("Lemon Pie", { course: D, protein: "", cuisine: "", tags: ["no-bake"], credit: "Jill Eckert" }, `
2 pkg lemon pudding
Milk (the amount for one package)
1 (8 oz) package cream cheese, softened
1 graham cracker crust
Cool Whip`, `
Mix both packages of lemon pudding with the milk for just one package.
Add the cream cheese and blend until smooth.
Pour into the crust and top with Cool Whip.
Chill in the refrigerator before serving.`),
];
