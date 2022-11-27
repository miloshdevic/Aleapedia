/* Auteurs: Théodore Jordan (20147067), Milosh Devic (20158232)
vendredi 13 décembre 2019

Ce programme a pour but de créer un modèle de markov de premier rang
pour n'importe quel texte.
À noter que le programme fonctionne pour n'importe quel taille de texte
mais avec le texte "wikipedia" cela prend assez plus de temps*/


// Utilitaires pour manipuler des fichiers
var fs = require("fs");

var readFile = function (path) {
    return fs.readFileSync(path).toString();
};

var writeFile = function (path, texte) {
    fs.writeFileSync(path, texte);
};


//début de notre code


//si retourne "true" alors c'est la fin du mot
var mots = function(x) {
	return (x != " ") && (x != "\n");
};


//repère tous les mots et les mets dans un tableau
var repererMots = function(texte) {
    var dictionnaire = [];//tableau qui contiendra les mots du texte
    var debut = 0;
    
    while (debut < texte.length) {
        
        if (mots(texte.charAt(debut))) {
            var i = debut+1;
            
            while (i < texte.length && mots(texte.charAt(i))) {
              	i++;
            }
			var mot = texte.slice(debut, i);
			
			if (mot.charAt(mot.length - 1) == ".") {
				
				//ajouter le mot et "" si c'est la fin d'une phrase
				dictionnaire.push(mot, "");
				debut = i+1;
			} else
            dictionnaire.push(mot);//place le mot dans le tableau
            debut = i+1;
        } else {
            debut++;
        }
    }
	dictionnaire.unshift("");
	dictionnaire.pop();//pour enlever le ""
    return dictionnaire;
};



/*prend un tableau et un index et retourne un nouveau tableau
permet de savoir combien de fois se répète un mot*/
var repetition = function (tab, index) {
	var nbrRepetition = 0;
	for (var k=0; k<tab.length; k++) {
		if (tab[index] == tab[k]) {
			nbrRepetition++;
		}
	}
	return nbrRepetition;
};




/*prend tableau et retourne nouveau tableau
retourne les probabilités du prochain mot*/
var prochainMot = function(tab) {
	var taille = tab.length;
	var proba = [];//contiendra les mots et leurs probabilités
	
	for (var i=0; i<taille-1; i++) {
		var nbrRepetition = repetition(tab, i);
		var prochain = [];
		for (var j=0; j<taille; j++) {
			if (tab[i] == tab[j]) {
				prochain.push({mot: tab[j+1], prob: 1/nbrRepetition});
			}
		}
		var filtrerTab = enleverRepetition(prochain);
		proba.push(filtrerTab);
	}
	return proba;
};



//pour ne pas avoir 2 fois le même mot dans un sous tableau
var enleverRepetition = function (tab) {
	var filtrerTab = [];
	
	for (var i=0; i<tab.length; i++) {
        var nbr = 1;
		for (var j=i+1; j<tab.length; j++) {
			if (tab[i].mot == tab[j].mot) {
				tab.splice(j,1);//retirer élément répété
				nbr++;//compter combien de répétitions
				j = j-1;
			}
		}
		tab[i].prob = tab[i].prob*nbr;//ajuster les probabilités
	}
	return filtrerTab.concat(tab);
};



//permet de créer le modele de Markov
var creerModele = function(texte) {
    var tabDeMots = repererMots(texte);
	var tabDeProb = prochainMot(tabDeMots);
	var modele = {dictionnaire: "", prochainsMots: ""};
	modele.dictionnaire = tabDeMots;
	modele.prochainsMots = tabDeProb;
	return modele;
	//return modele.dictionnaire;
	//return modele.prochainsMots;//pour un affichage complet au lieu de "object"
};





//choisit aléatoirement le mot suivant en fonction des probabilités
var choisirMot = function (tab) {
	var nbrMots = tab.length;
	tab = changerProba(tab, nbrMots);
	var nbrAleatoire = Math.random();
	
	if (0<nbrAleatoire && nbrAleatoire<=tab[0].prob)
		return tab[0].mot;
	else {
		for (var i=1; i<nbrMots; i++) {
			if (tab[i-1].prob<nbrAleatoire && nbrAleatoire<=tab[i].prob)
				return tab[i].mot;
		}
	}
	
};

/*changer les valeurs des probabilités des mots tel que ça donne des
intervalles disjointes pour pouvoir se servir de "Math.random()" pour
prendre le prochain mot*/
var changerProba = function(tab, taille) {
	var somme = 0;
	for (var i=0; i<taille; i++) {
		somme += tab[i].prob;
		tab[i].prob = somme;
	}
	return tab;
};


//permet de générer aléatoirement le mot suivant grâce au modèle créé
var genererProchainMot = function(modele, motActuel) {
	// On retrouve la position du mot cherché
	var index = modele.dictionnaire.indexOf(motActuel);
	var prochainsMotsPossibles = modele.prochainsMots[index];
	return choisirMot(prochainsMotsPossibles);
};


/*permet de générer aléatoirement une phrase ayant un nombre maximal de mots
fixe et utilisant le modèle créé*/
var genererPhrase = function(modele, maxNbMots) {
    var motActuel = "";
	var phrase = "";
	var i = 0;
	
	while (i<maxNbMots) {
		var prochainMot = genererProchainMot(modele, motActuel);
		
		//arrêter la fonction car il y a un point --> fin de phrase
		if (prochainMot.charAt(prochainMot.length-1) == ".") {
			phrase += prochainMot + " ";
			return phrase;
		}
		else {
			//pour qu'il y ait un espace entre les mots
			phrase += prochainMot + " ";
		}
		//nouveau mot actuel
		motActuel = prochainMot;
		i++;
	}
	phrase += ".";
	return phrase;
};

/*
permet de générer des paragraphes ayant un nombre de paragraphes fixe,
un nombre maximal de phrases par paragraphe fixe et un nombre maximal de mots
par phrase fixe. Le contenu est généré aléatoirement en fonction du modèle créé
*/
var genererParagraphes = function(modele, nbParagraphes, maxNbPhrases, maxNbMots) {
	var tabParagraphe = Array(nbParagraphes);
	for (var i=0; i<nbParagraphes; i++) {
		var paragraphe = "";
		var nbrPhrases = Math.floor(Math.random()*maxNbPhrases) + 1;
		for (var j=0; j<nbrPhrases; j++) {
		var nouvellePhrase = genererPhrase(modele, maxNbMots);
		paragraphe += nouvellePhrase;
		}
		tabParagraphe[i] = paragraphe;
	}
	return tabParagraphe;
};
//console.log(genererParagraphes(modele, 3, 6, 15));

//pour les tests:
var texte1 = "A B C.\nA B A.\nC B A.";

var texte2 = "Je m'appelle Marguerite Lafontaine.";

var texte3 = "";

var tab1 = ['', 'A', 'B', 'C.','', 'A', 'B', 'A.','', 'C', 'B', 'A.'];

var tab2 = ['','Je',"m'appelle",'Marguerite', 'Lafontaine.'];

var tab3 = [
  [
    { mot: 'A', prob: 0.6666666666666666 },
    { mot: 'C', prob: 0.3333333333333333 }
  ],
  [ { mot: 'B', prob: 1 } ],
  [
    { mot: 'C.', prob: 0.3333333333333333 },
    { mot: 'A.', prob: 0.6666666666666666 }
  ],
  [ { mot: '', prob: 1 } ],
  [
    { mot: 'A', prob: 0.6666666666666666 },
    { mot: 'C', prob: 0.3333333333333333 }
  ],
  [ { mot: 'B', prob: 1 } ],
  [
    { mot: 'C.', prob: 0.3333333333333333 },
    { mot: 'A.', prob: 0.6666666666666666 }
  ],
  [ { mot: '', prob: 0.5 }, { mot: undefined, prob: 0.5 } ],
  [
    { mot: 'A', prob: 0.6666666666666666 },
    { mot: 'C', prob: 0.3333333333333333 }
  ],
  [ { mot: 'B', prob: 1 } ],
  [
    { mot: 'C.', prob: 0.3333333333333333 },
    { mot: 'A.', prob: 0.6666666666666666 }
  ]
];

var tab4 = [[ { mot: 'Je', prob: 1 } ],
            [ { mot: "m'appelle", prob: 1 } ],
            [ { mot: 'Marguerite', prob: 1 } ],
            [ { mot: 'Lafontaine.', prob: 1 } ]];

var tab5 = [];

var tab6 = [];

var tab7 =  [{ mot: 'Je', prob: 0.25 },
			{ mot: 'Je', prob: 0.25 },
			{ mot: 'En', prob: 0.25 },
			{ mot: 'Ma', prob: 0.25 }];

var tab8 = [{ mot: 'Je', prob: 0.5 },
			{ mot: 'En', prob: 0.25 },
			{ mot: 'Ma', prob: 0.25 }];

var tab9 = [{ mot: '', prob: 1 }];

var tab10 = [{ mot: 'Lafontaine.', prob: 0.3333333333333333 },
             { mot: 'est', prob: 0.3333333333333333 },
             { mot: 'car', prob: 0.3333333333333333 }];

var tab11 = [{mot: "m'appelle", prob: 1}];

var tab12 = [{ mot: 'Je', prob: 0.5 },
             { mot: 'En', prob: 0.75 },
             { mot: 'Ma', prob: 1 }];

var tab13 = [{ mot: 'Lafontaine.', prob: 0.3333333333333333 },
			 { mot: 'est', prob: 0.6666666666666666 },
			 { mot: 'car', prob: 1 }];

var modele1 = {
  dictionnaire: [
    '', 'A', 'B', 'C.',
    '', 'A', 'B', 'A.',
    '', 'C', 'B', 'A.'
  ],
  prochainsMots: [
  [
    { mot: 'A', prob: 0.6666666666666666 },
    { mot: 'C', prob: 0.3333333333333333 }
  ],
  [ { mot: 'B', prob: 1 } ],
  [
    { mot: 'C.', prob: 0.3333333333333333 },
    { mot: 'A.', prob: 0.6666666666666666 }
  ],
  [ { mot: '', prob: 1 } ],
  [
    { mot: 'A', prob: 0.6666666666666666 },
    { mot: 'C', prob: 0.3333333333333333 }
  ],
  [ { mot: 'B', prob: 1 } ],
  [
    { mot: 'C.', prob: 0.3333333333333333 },
    { mot: 'A.', prob: 0.6666666666666666 }
  ],
  [ { mot: '', prob: 0.5 }, { mot: undefined, prob: 0.5 } ],
  [
    { mot: 'A', prob: 0.6666666666666666 },
    { mot: 'C', prob: 0.3333333333333333 }
  ],
  [ { mot: 'B', prob: 1 } ],
  [
    { mot: 'C.', prob: 0.3333333333333333 },
    { mot: 'A.', prob: 0.6666666666666666 }
  ]
]
};

var modele2 = {
  dictionnaire: [ '', 'Je', "m'appelle", 'Marguerite', 'Lafontaine.' ],
  prochainsMots: [
  [ { mot: 'Je', prob: 1 } ],
  [ { mot: "m'appelle", prob: 1 } ],
  [ { mot: 'Marguerite', prob: 1 } ],
  [ { mot: 'Lafontaine.', prob: 1 } ]
]
};

var modele3 = { dictionnaire: [], prochainsMots: [] };


var tests = function() {
	
	//tests pour "mot"
	console.assert(mots(" ") == false);
	console.assert(mots("\n") == false);
	console.assert(mots("h") == true);
	
	//tests pour "repererMots"
	console.assert(JSON.stringify(repererMots(texte1)) == JSON.stringify(tab1));
	console.assert(JSON.stringify(repererMots(texte2)) ==
    JSON.stringify(tab2));
	console.assert(JSON.stringify(repererMots("")) == JSON.stringify([]));
	
	//tests pour "repetition"
	console.assert(repetition(tab1, 1) == 2);
	console.assert(repetition(tab2, 2) == 1);
	console.assert(repetition(tab1, 2) == 3);
	
	//tests pour "prochainMot"
	console.assert(JSON.stringify(prochainMot(tab1)) == JSON.stringify(tab3));
	console.assert(JSON.stringify(prochainMot(tab2)) == JSON.stringify(tab4));
	console.assert(JSON.stringify(prochainMot(tab5)) == JSON.stringify(tab6));
	
	//tests pour "enleverRepetition"
	console.assert(JSON.stringify(enleverRepetition(tab7)) == JSON.stringify(tab8));
	console.assert(JSON.stringify(enleverRepetition(tab8)) == JSON.stringify(tab8));
	console.assert(JSON.stringify(enleverRepetition(tab9)) == JSON.stringify(tab9));
	
	//tests pour "creerModele"
	console.assert(JSON.stringify(creerModele(texte1)) == JSON.stringify(modele1));
	console.assert(JSON.stringify(creerModele(texte2)) == JSON.stringify(modele2));
	console.assert(JSON.stringify(creerModele(texte3)) == JSON.stringify(modele3));
	
	//tests pour "changerProba"
	console.assert(JSON.stringify(changerProba(tab10, 3)) == JSON.stringify(tab13));
	console.assert(JSON.stringify(changerProba(tab11, 1)) == JSON.stringify(tab11));
	console.assert(JSON.stringify(changerProba(tab8, 3)) == JSON.stringify(tab12));
	
	/*Les autres fonctions n'ont pas besoin d'être testées car elles
	contiennent "Math.random()".*/

    console.log('Les tests sont bons!');
};



if (require.main === module) {
    // Si on se trouve ici, alors le fichier est exécuté via : nodejs markov.js
    tests(); // On lance les tests
} else {
    /* Sinon, le fichier est inclus depuis index.js
       On exporte les fonctions importantes pour le serveur web */
    exports.creerModele = creerModele;
    exports.genererParagraphes = genererParagraphes;
}