import fs from 'fs/promises';
import { searchRecipes } from 'marmiton-api';

async function getIngredientsForRecipe() {
    // Étape 1: Lire tous les fichiers JSON du dossier 'json'
    const ingredientsData = await getAllIngredientsFromJSONFolder();

    // Étape 2: Rechercher des recettes
    const recipes = await searchRecipes("", ["tomate", "fromage"], { limit: 3 });

    // Pour chaque recette, nous allons trouver les ingrédients et leurs prix
    for (const recipe of recipes) {
        let totalCost = 0;
        const ingredientsToBuy = [];

        for (const ingredient of recipe.ingredients) {
            const details = extractIngredientDetails(ingredient);

            console.log('--------------------------');
            console.log(details);
            
            if (!details) continue;
            
            // Cherchez d'abord une correspondance exacte
            let foundIngredient = ingredientsData.find(item => {
                const ingredientName = toSingular(details.name.toLowerCase().replace(' frais', ''));
                const itemName = toSingular(item.name.toLowerCase());
            
                // Priorité aux correspondances exactes
                if (itemName === ingredientName) return true;
            
                // Si ce n'est pas une correspondance exacte, vérifiez si les mots clés correspondent
                const ingredientWords = ingredientName.split(/\s+/);
                const matchingWords = ingredientWords.filter(word => itemName.includes(word));
            
                // Si au moins la moitié des mots correspondent, considérez cela comme une correspondance valide
                return matchingWords.length >= Math.ceil(ingredientWords.length / 2);
            });
            
            // Si aucune correspondance exacte n'est trouvée, cherchez une correspondance partielle
            if (!foundIngredient) {
                const matchingIngredients = ingredientsData
                    .filter(item => item.name.toLowerCase().includes(details.name.toLowerCase()))
                    .sort((a, b) => getPriceNumber(a.price) - getPriceNumber(b.price));
                
                foundIngredient = matchingIngredients[0];
            }
            
            if (foundIngredient) {
                ingredientsToBuy.push({
                    name: foundIngredient.name,
                    price: foundIngredient.price
                });
        
                totalCost += getPriceNumber(foundIngredient.price);
            }
        }

        // Étape pour fusionner les doublons
        const mergedIngredientsMap = new Map();
        ingredientsToBuy.forEach(ingredient => {
            const existing = mergedIngredientsMap.get(ingredient.name);
            if (existing) {
                existing.quantity += ingredient.quantity;
            } else {
                mergedIngredientsMap.set(ingredient.name, ingredient);
            }
        });
        const mergedIngredients = Array.from(mergedIngredientsMap.values());

        console.log(`Recette: ${recipe.name}`);
        console.log('Ingrédients à acheter:');
        for (const item of mergedIngredients) {
            console.log(`- ${item.name}: ${item.price}`);
        }
        console.log(`Coût total: ${totalCost.toFixed(2)}€`);
        console.log('--------------------------');
    }
}

function extractIngredientDetails(input) {
    const regex = /(\d+\/\d+|\d+(\.\d+)?|\.\d+)?\s*([\p{L}\s']+)/u;
    const match = input.match(regex);
    if (match) {
        let quantity = match[1] ? eval(match[1]) : 1;
        let name = match[3].trim();

        // Si les unités sont en "g" ou "cl", réinitialiser la quantité à 1
        if (/g|cl/.test(name)) {
            quantity = 1;
        }

        name = checkAndReplace(name);

        // Nettoyer le nom de l'ingrédient
        name = name.replace(/g de /, '')
                   .replace(/cl de /, '')
                   .replace(/^de /, '')
                   .trim();

        // Arrondir la quantité à l'entier supérieur si c'est un nombre à virgule
        quantity = Math.ceil(quantity);

        return {
            quantity,
            name
        };
    }
    return null;
}

function getPriceNumber(priceString) {
    return parseFloat(priceString.replace('€', '').replace(',', '.'));
}

function checkAndReplace(name) {

    const ingredientMappings = {
        'tomate': 'tomate ronde',
        'salade': 'salade',
        'jambon': 'jambon cru',
    };

    for (const key in ingredientMappings) {
        if (name.includes(key)) {
            name = ingredientMappings[key];
            break;  // Sortir de la boucle dès qu'une correspondance est trouvée
        }
    }
    
    // Vérifier le singulier si le nom est au pluriel
    if (name.endsWith('s')) {
        return ingredientMappings[name.slice(0, -1)] || name;
    }

    // Vérifier le pluriel si le nom est au singulier
    return ingredientMappings[name + 's'] || name;
}

function toSingular(word) {
    if (word.endsWith('s')) {
        return word.slice(0, -1);
    }
    return word;
}

async function getAllIngredientsFromJSONFolder() {
    const fileNames = await fs.readdir('json');
    const jsonFiles = fileNames.filter(file => file.endsWith('.json'));
    let allIngredients = [];

    for (const file of jsonFiles) {
        const rawData = await fs.readFile(`json/${file}`, 'utf-8');
        const ingredients = JSON.parse(rawData);
        allIngredients = [...allIngredients, ...ingredients];
    }

    return allIngredients;
}

getIngredientsForRecipe();
