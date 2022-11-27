document.addEventListener('DOMContentLoaded', function() {
    // Lire un article arbitraire
    var nom = document.getElementById('lire-article-nom');
    var btn = document.getElementById('lire-article-btn');

    function submit() {
        window.location = '/article/' + nom.value;
    };

    btn.onclick = submit;
    nom.onkeyup = function(event) {
        if (event.key === "Enter") {
            submit();
        }
    };
});
