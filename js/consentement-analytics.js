/* Smartz Formation — consentement statistiques et Google Tag Manager.
   Le conteneur GTM est chargé uniquement après consentement explicite. */
(function () {
  'use strict';
  var KEY = 'smartz-statistiques-consentement-v1';
  var GTM_ID = 'GTM-MXVLTDTP';
  var loaded = false;
  var choice = null;
  try { choice = localStorage.getItem(KEY); } catch (_) {}
  function loadGTM() {
    if (loaded) return;
    loaded = true;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({'gtm.start': new Date().getTime(), event: 'gtm.js'});
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(GTM_ID);
    document.head.appendChild(script);
  }
  if (choice === 'accepted') loadGTM();

  function ready() {
    var style = document.createElement('style');
    style.textContent = '#smartz-cookie-banner{position:fixed;z-index:2147483647;bottom:18px;left:18px;right:18px;max-width:740px;margin:auto;background:#102a35;color:#f3fbfc;border:1px solid #58cfc9;border-radius:14px;padding:18px 20px;box-shadow:0 8px 35px #0009;font:15px/1.5 system-ui,sans-serif}#smartz-cookie-banner p{margin:7px 0 13px}#smartz-cookie-banner button,#smartz-cookie-settings{cursor:pointer;font:inherit}#smartz-cookie-banner .smartz-buttons{display:flex;flex-wrap:wrap;gap:10px}#smartz-cookie-banner button{border:1px solid #69dcd1;border-radius:9px;padding:9px 16px;background:transparent;color:#f3fbfc;font-weight:650}#smartz-cookie-banner button[data-choice="accepted"]{background:#51dacd;color:#07121a}#smartz-cookie-settings{position:fixed;z-index:2147483646;left:10px;bottom:8px;background:#102a35;color:#eaf8f8;border:1px solid #4b8187;border-radius:8px;padding:6px 10px;font:12px system-ui,sans-serif;opacity:.88}#smartz-cookie-settings:focus-visible,#smartz-cookie-banner button:focus-visible{outline:3px solid #ffbd65;outline-offset:2px}';
    document.head.appendChild(style);
    var settings = document.createElement('button');
    settings.id = 'smartz-cookie-settings';
    settings.type = 'button';
    settings.textContent = 'Confidentialité';
    settings.setAttribute('aria-label','Modifier mon choix concernant les statistiques');
    document.body.appendChild(settings);

    function show() {
      if (document.getElementById('smartz-cookie-banner')) return;
      var box = document.createElement('section');
      box.id = 'smartz-cookie-banner';
      box.setAttribute('role','dialog');
      box.setAttribute('aria-label','Choix des statistiques');
      box.innerHTML = '<strong>Statistiques de fréquentation</strong><p>Avec votre accord, Smartz Formation utilise Google Tag Manager et Google Analytics pour comprendre quelles pages sont consultées. Vous pouvez refuser sans conséquence sur votre navigation et modifier votre choix à tout moment.</p><div class="smartz-buttons"><button type="button" data-choice="rejected">Refuser</button><button type="button" data-choice="accepted">Accepter les statistiques</button></div>';
      document.body.appendChild(box);
      box.querySelectorAll('[data-choice]').forEach(function(btn){
        btn.addEventListener('click',function(){
          var value = btn.getAttribute('data-choice');
          try { localStorage.setItem(KEY,value); } catch (_) {}
          box.remove();
          if (value === 'accepted') loadGTM();
          else if (loaded) window.location.reload();
        });
      });
    }
    settings.addEventListener('click',show);
    if (choice !== 'accepted' && choice !== 'rejected') show();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',ready);
  else ready();
})();
