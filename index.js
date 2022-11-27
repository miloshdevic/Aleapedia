/* Auteurs: Théodore Jordan (20147067), Milosh Devic (20158232)
vendredi 13 décembre 2019

Ce programme a pour but de créer un serveur qui génère des pages
aléatoires de wikipédia ainsi que des articles en se servant du
modèle de Markov.*/




'use strict';

var http = require("http");
var fs = require('fs');
var urlParse = require('url').parse;
var pathParse = require('path').parse;
var querystring = require('querystring');
var crypto = require('crypto');
var request = require('sync-request');
var Entities = require('html-entities').AllHtmlEntities;
var entities = new Entities();

// Votre librairie est incluse ici
var markov = require('./markov.js');

// Fonctions exportées
var creerModele = null;
var genererParagraphes = markov.genererParagraphes;

// Liste de premières phrases possibles pour les articles
// Ajoutez-en si vous avez des idées!
var premieresPhrases = [
    "<strong>{{titre}}</strong> est un animal aquatique nocturne.",
    "<strong>{{titre}}</strong> (du grec ancien <em>\"{{titre-1}}\"</em> et <em>\"{{titre-2}}\"</em>), est le nom donné par Aristote à la vertu politique.",
    "<strong>{{titre}}</strong>, né le 30 août 1987 à Portland (Oregon), est un scénariste américain.",
    "<strong>{{titre}}</strong>, née le 30 septembre 1982 à Québec, est une femme politique québécoise.",
    "<strong>{{titre}}</strong> est défini comme « l'ensemble des règles imposées aux membres d'une société pour que leurs rapports sociaux échappent à l'arbitraire et à la violence des individus et soient conformes à l'éthique dominante ».",
    "<strong>{{titre}}</strong>, néologisme du XXe siècle, attesté en 1960, composite du grec ancien <em>{{titre-1}}</em> et du latin <em>{{titre-2}}</em>, est le principe déclencheur d'événements non liés à une cause connue.",
    "<strong>{{titre}}</strong> est une espèce fossile d'euryptérides ressemblant aux arachnides, appartenant à la famille des <em>{{titre-1}}</em>.",
    "<strong>{{titre}}</strong>, né le 25 juin 1805 à Lyon et mort le 12 février 1870 à Versailles, est un peintre animalier français.",
    "<strong>{{titre}}</strong> est le titre d'un épisode de la série télévisée d'animation Les Simpson. Il s'agit du quatre-vingt-dix-neuvième épisode de la soixante-huitième saison et du 8 615e épisode de la série.",
    "<strong>{{titre}}</strong>, composé de <em>{{titre-1}}</em>- et de -<em>{{titre-2}}</em>, consiste en l'étude d'une langue et de sa littérature à partir de documents écrits."
];

// --- Utilitaires ---
var readFile = function (path, binary) {
    if (!binary)
        return fs.readFileSync(path).toString('utf8');
    return fs.readFileSync(path, { encoding: 'binary' });
};

var writeFile = function (path, texte) {
    fs.writeFileSync(path, texte);
};

// ---------------------------------------------------------
//  Fonctions pour communiquer avec Wikipédia
//  (trouver des articles au hasard et extraire des images)
// ---------------------------------------------------------

/*
 * Requête *synchrone* pour obtenir du JSON depuis un API
 * quelconque.
 *
 * NOTEZ : ce code fait l'affaire pour ce TP, mais ne serait pas
 * acceptable dans un vrai serveur web. Pour simplifier le travail à
 * faire dans ce TP, on va néanmoins utiliser cette approximation, qui
 * serait beaucoup trop lente à exécuter sur un vrai site pour ne pas
 * que le site "laggue".
 */
var jsonRequestSync = function (url) {
    try {
        var response = request('GET', url);
    } catch (e) {
        return false;
    }

    if (response.statusCode != '200') {
        console.error(new Error("Page web invalide").stack);
        return false;
    }

    try {
        return JSON.parse(response.body.toString());
    } catch (e) {
        console.error(new Error("Page web invalide").stack);
    }
};

/*
 * Retourne un tableau contenant `n` titres de pages au hasard de
 * Wikipédia français
 */
var getRandomPageTitles = function (n) {
    var req = jsonRequestSync('https://fr.wikipedia.org/w/api.php?action=query&list=random&rnnamespace=0&rnlimit=' + n + '&format=json');

    if (!req) {
        return Array(n).fill("Pas d'internet");
    }

    return req.query.random.map(function (x) {
        return x.title;
    });
};

var md5 = function (data) {
    return crypto.createHash('md5').update(data).digest("hex");
};

/*
 * Découpe le nom de fichier donné par Wikipédia pour l'image et
 * retourne son URL
 */
var fileUrl = function (wikipediaName) {
    var filename = wikipediaName.slice('Fichier:'.length).split(' ').join('_');

    var hash = md5(filename).slice(0, 2);

    return "https://upload.wikimedia.org/wikipedia/commons/" + hash[0] + '/' + hash + '/' + filename;
};

/*
 * Retourne l'URL de la première image de l'article Wikipédia dont le
 * titre est title.
 */
var getPageFirstImage = function (title) {
    var encodedTitle = encodeURIComponent(title);

    var pageUrl = "https://fr.wikipedia.org/w/api.php?action=query&titles=" +
        encodedTitle + "&format=json&prop=images&imlimit=30";

    var req = jsonRequestSync(pageUrl);

    if (!req) {
        return undefined;
    }

    var pages = req.query.pages;

    if (typeof (pages[-1]) === "undefined") {
        var page = Object.values(pages)[0];

        if (typeof (page.images) === 'undefined') {
            return false;
        }

        var images = page.images.map(function (img) {
            return img.title;
        });

        images = images.filter(function (x) {
            var parts = x.split('.');
            return ['jpg', 'png', 'jpeg', 'gif'].indexOf(parts[parts.length - 1]) !== -1;
        });

        if (images.length > 0)
            return images[0];
    }

    return false;
};

/*
 * Retourne une image de Wikipédia Français pour l'article nommé
 * title. Si l'article existe, et comporte des images, cette fonction
 * retourne la première image de l'article (selon l'ordre retourné par
 * l'API de Wikipédia), sinon cette fonction trouve une image au
 * hasard.
 */
var getImage = function (title) {

    var img = false;
    var url;
    do {

        if (typeof (title) !== 'undefined') {
            // 1. Vérifier si la page Wikipédia de "title" existe
            img = getPageFirstImage(title);
        }

        if (!img) {
            do {
                // 2. Lister 10 articles au hasard de Wikipédia
                var randomPages = getRandomPageTitles(10);

                for (var i = 0; i < randomPages.length; i++) {
                    img = getPageFirstImage(randomPages[i]);
                    if (img !== false) {
                        break;
                    }
                }
            } while (img === false);
        }

        if (img === undefined) {
            // Pas d'internet
            return '/no-internet.png';
        }

        url = fileUrl(img);

        title = undefined;
        img = false;

        try {
            var response = request('HEAD', url);

            // Image trop petite, on en trouve une autre
            if (response.headers['content-length'] < 30000) {
                response = false;
                continue;
            }
        } catch (e) {
            continue;
        }

    } while (!response || response.statusCode != '200');

    return url;
};

// --------------------
//  Gestion du serveur
// --------------------
var port = 1337;
var hostUrl = 'http://localhost:' + port + '/';
var defaultPage = '/index.html';

var mimes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
};

// --- Server handler ---
var redirect = function (reponse, path, query) {
    var newLocation = path + (query == null ? '' : '?' + query);
    reponse.writeHeader(302, { 'Location': newLocation });
    reponse.end('302 page déplacée');
};

var getDocument = function (url) {
    var pathname = url.pathname;
    var parsedPath = pathParse(url.pathname);
    var result = { data: null, status: 200, type: null };

    if (Object.keys(mimes).indexOf(parsedPath.ext) != -1) {
        result.type = mimes[parsedPath.ext];
    } else {
        result.type = 'text/plain';
    }

    try {
        if (['.png', '.jpg'].indexOf(parsedPath.ext) !== -1) {
            result.data = readFile('./public' + pathname, { encoding: 'binary' });
            result.encoding = 'binary';
        } else {
            result.data = readFile('./public' + pathname);
        }
        console.log('[' + new Date().toLocaleString('iso') + "] GET " + url.path);
    } catch (e) {
        // File not found.
        console.log('[' + new Date().toLocaleString('iso') + "] GET " +
            url.path + ' not found');
        result.data = readFile('template/error404.html');
        result.type = 'text/html';
        result.status = 404;
    }

    return result;
};

var sendPage = function (reponse, page) {
    reponse.writeHeader(page.status, { 'Content-Type': page.type });
    reponse.end(page.data, page.encoding || 'utf8');
};



/*
-------------------------------------------------------------------------------
                           _____ ___  ____   ___
                          |_   _/ _ \|  _ \ / _ \
                            | || | | | | | | | | |
                            | || |_| | |_| | |_| |
                            |_| \___/|____/ \___/
                   Le code à compléter se trouve ci-dessous
-------------------------------------------------------------------------------
*/




// -------------------------------------
//  Logique de l'application ci-dessous
//    LE SEUL CODE QUE VOUS AVEZ À
//       MODIFIER EST CI-DESSOUS
// -------------------------------------




//permet de substituer un élément d'un texte par un autre
var substituerEtiquette = function (texte, etiquette, valeur) {
    var taille = etiquette.length;
    var i = 0;
    //compter le nombre de d'accolade consécutive dans l'étiquette
    while (etiquette.charAt(i) == "{") {
        i++;
    }
    //dans le cas où il y a plusieurs fois la même étiquette
    while (texte.search(etiquette) != -1) {
        if (i == 2) {
            var nouvelleValeur = entities.encode(valeur);
            var index = texte.search(etiquette);
            texte.substring(index, index + taille);
            texte = texte.substring(0, index) + nouvelleValeur +
                " " + texte.substring(index + taille);
        } else {
            var index = texte.search(etiquette);
            texte.substring(index, index + taille);
            texte = texte.substring(0, index) + valeur + " " +
                texte.substring(index + taille);
        }
    }
    return texte;
};


//permet d'avoir la page d'accueil du site
var getIndex = function () {
    var index = readFile("template/index.html");//retourne le code en string

    var titres = getRandomPageTitles(20);//obtenir liste de titres

    //rajouter les balises html "<li>" et "</li>" pour que cela soit une liste
    //et rajouter <a href=""</a> pour que cela soit un lien
    var titresHtml = titres.map(function (n) {
        return '<li><a href="/article/' + n + '">' + n + '</a></li>';
    });

    var imageUrl = getImage();//obtenir le url d'une image au hasard

    //pour modifier les valeurs des étiquettes
    index = substituerEtiquette(index, "{{{articles-recents}}}", titresHtml.join(""));
    index = substituerEtiquette(index, "{{img}}", imageUrl);

    return index;
};



//permet d'obtenir les pages d'article en cliquant sur un titre
var getArticle = function (titre) {
    if (creerModele == null)
        creerModele = markov.creerModele(shortPoint(readFile("corpus/wikipedia"), 500));
   
    var article = readFile("template/article.html");//retourne le code en string

    var titre1 = moitie1(titre);//première moitié du titre
    var titre2 = moitie2(titre);//deuxième moitié du titre

    var imageUrl = getImage();//obtenir le url de l'image du titre

    //le transforme en stringw
    var premier = modifierPremieresPhrases(titre, titre1, titre2);

    //obtention d'un texte grâce au modèle de markov
    var texte = genererParagraphes(creerModele, Math.floor((Math.random() * 6) + 3), Math.floor((Math.random() * 8) + 3),
	Math.floor((Math.random() * 15) + 8));//c'est un tableau
    texte = modificationDeTexte(texte); //c'est un string

    var contenu = obtenirContenu(premier, texte);//obtenir le contenu de la page    

    //faire les substitutions nécéssaires pour modifier la page
    article = substituerEtiquette(article, "{{titre}}", titre);
    article = substituerEtiquette(article, "{{img}}", imageUrl);
    article = substituerEtiquette(article, "{{{contenu}}}", contenu); 
    return article;
};



//obtenir la première moitié du titre
var moitie1 = function (titre) {
    var titre1 = "";
    var taille = titre.length;
    if (taille % 2 == 0) {
        var demi = taille / 2;
        titre1 = titre.substring(0, demi);
    } else if (taille % 2 == 1) {
        var demi = (taille / 2) - 0.5;
        titre1 = titre.substring(0, demi);
    }
    return titre1;
};



//obtenir la deuxième moitié du titre
var moitie2 = function (titre) {
    var titre2 = "";
    var taille = titre.length;
    if (taille % 2 == 0) {
        var demi = taille / 2;
        titre2 = titre.substring(demi);
    } else if (taille % 2 == 1) {
        var demi = (taille / 2) - 0.5;
        titre2 = titre.substring(demi);
    }
    return titre2;
};



//regarder pour les minuscules
function isaz(x) {
    for (var i = 0; i <= x.length; i++) {
        if (x[i] < 'a' || x[i] > 'z')
            return false;
    }
    return true;
};



//regarder pour les majuscules
function isAZ(x) {
    for (var i = 0; i <= x.length; i++) {
        if (x[i] < 'A' || x[i] > 'Z')
            return false;
    }
    return true;
};



//modifie le texte en ajoutant du HTML aléatoire
var modificationDeTexte = function (texte) {
    var nbrAleatoire;

    texte = texte.map(function (x) {
        var tabParagraphe = repererMots(x);
        return tabParagraphe.map(function (y) {
            if (y.length >= 7 && (isaz(y) || isAZ(y))) {
                nbrAleatoire = Math.floor(Math.random() * 100) + 1;
                if (nbrAleatoire <= 15) {
                    return "<strong>" + y + "</strong>";
                } else if (nbrAleatoire <= 30) {
                    return "<em>" + y + "</em>";
                } else if (nbrAleatoire <= 45) {
                    return "<a href=\"/article/" + y + "\">" + y + "</a>";
                }
            } else {
                return y;
            }
        }).join(" ");
    });

    texte = texte.map(function (x) {
        return "<p>" + x + "</p>";
    });

    return texte.join(" ");
};



//pour prendre moins de contenu de "wikipedia" car le code fonctionne
//mais est plus lent
function shortPoint(str, nb) {
    var sum = 0;
    for (var i = 0; i < str.length; i++) {
        if (str[i] == '.')
            sum += 1;

        if (sum == nb)
            return str.substring(0, i + 1);
    }
};



//remplacer les éléments à remplacer par les titres
//prend un tableau et retourne un string
var modifierPremieresPhrases = function (titre, titre1, titre2) {
    var premier = premieresPhrases[Math.floor(Math.random() * premieresPhrases.length)];
    premier = substituerEtiquette(premier, "{{titre}}", titre);
    premier = substituerEtiquette(premier, "{{titre-1}}", titre1);
    premier = substituerEtiquette(premier, "{{titre-2}}", titre2);
    return premier + "\n";  
};

//si retourne "true" alors c'est la fin du mot
var mots = function (x) {
    return (x != " ") && (x != "\n");
};

//repère tous les mots et les mets dans un tableau
//même fonction que dans markov.js
var repererMots = function (texte) {
    var dictionnaire = [];//tableau qui contiendra les mots du texte
    var debut = 0;

    while (debut < texte.length) {

        if (mots(texte.charAt(debut))) {
            var i = debut + 1;

            while (i < texte.length && mots(texte.charAt(i))) {
                i++;
            }
            var mot = texte.slice(debut, i);

            if (mot.charAt(mot.length - 1) == ".") {

                //ajouter le mot et "" si c'est la fin d'une phrase
                dictionnaire.push(mot, "");
                debut = i + 1;
            } else
                dictionnaire.push(mot);//place le mot dans le tableau
            debut = i + 1;
        } else {
            debut++;
        }
    }
    dictionnaire.unshift("");
    dictionnaire.pop();//pour enlever le ""
    return dictionnaire;
};


//prends en paramètre deux textes et en retourne un
var obtenirContenu = function (premier, texte) {
    var contenu = premier + texte;
    return contenu;
};







/*
 * Création du serveur HTTP
 * Note : pas besoin de toucher au code ici (sauf peut-être si vous
 * faites les bonus)
 */
http.createServer(function (requete, reponse) {
    var url = urlParse(requete.url);

    // Redirect to index.html
    if (url.pathname == '/') {
        redirect(reponse, defaultPage);
        return;
    }

    var doc;

    if (url.pathname == defaultPage) {
        // Index
        doc = { status: 200, data: getIndex(), type: 'text/html' };
    } else if (url.pathname == '/random') {
        // Page au hasard
        redirect(reponse, '/article/' + encodeURIComponent(getRandomPageTitles(1)[0]));
        return;
    } else {
        var parsedPath = pathParse(url.pathname);

        if (parsedPath.dir == '/article') {
            var title;

            try {
                title = decodeURIComponent(parsedPath.base);
            } catch (e) {
                title = parsedPath.base.split('%20').join(' ');
            }

            // Force les articles à commencer avec une majuscule si c'est une lettre
            var capital = title.charAt(0).toUpperCase() + title.slice(1);
            if (capital != title) {
                redirect(reponse, encodeURIComponent(capital));
                return;
            }

            doc = { status: 200, data: getArticle(title), type: 'text/html' };
        } else {
            doc = getDocument(url);
        }
    }

    sendPage(reponse, doc);
}).listen(port);