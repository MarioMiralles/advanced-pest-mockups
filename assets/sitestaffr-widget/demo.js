/*
 * The SiteStaffr floating widget for static mockups: the plugin's own stylesheets and chat window
 * (sitestaffr-panel.js, unmodified) with canned replies in place of the server. Nothing is sent anywhere.
 *
 * Configure on the script tag:
 *   data-accent     main color (the owner's Main color: launcher, panel brand)
 *   data-business   business name (chat header and launcher welcome line)
 *   data-teaser     the launcher's welcome line (default: "Questions about <business>? Ask by voice or text.")
 *   data-greeting   first message in the text chat
 *   data-reply      the answer to anything the visitor types
 *   data-reply-es   the answer when the visitor writes in Spanish (omit to always use data-reply)
 *   data-look       front_desk (default), concierge, workshop, quick_sheet, talk_now, poster, blueprint, sketch
 *   data-icon       typing (default), bubble, sparkle, waveform, microphone, chat, headset, phone
 *   data-phone      business phone, shown as the call line or action (optional)
 *   data-questions  up to three common questions, separated by |
 *   data-mode       both (default), text or voice
 *   data-position   bottom-right (default) or bottom-left
 * data-initials and data-subtitle are read by the old assets/chat.js only: the real header always shows
 * the name's first letter and the literal "AI assistant" disclosure.
 */
(function () {
  'use strict';

  var tag = document.currentScript;
  var base = tag.src.replace(/[^/]*$/, '');
  function opt(name, fallback) {
    var v = tag.getAttribute('data-' + name);
    return v == null || v.trim() === '' ? fallback : v.trim();
  }

  var LOOKS = {
    front_desk: { bg: 'light', corners: 'site', start: 'talk_type', phone: 'full', mark: 'logo' },
    concierge: { bg: 'tinted', corners: 'square', start: 'talk_type', phone: 'full', mark: 'initial' },
    workshop: { bg: 'dark', corners: 'square', start: 'talk_type', phone: 'full', mark: 'logo' },
    quick_sheet: { bg: 'light', corners: 'round', start: 'main_actions', phone: 'sheet', mark: 'logo' },
    talk_now: { bg: 'light', corners: 'round', start: 'voice_first', phone: 'full', mark: 'logo' },
    poster: { bg: 'light', corners: 'square', start: 'talk_type', phone: 'full', mark: 'logo' },
    blueprint: { bg: 'light', corners: 'square', start: 'talk_type', phone: 'full', mark: 'logo' },
    sketch: { bg: 'light', corners: 'round', start: 'talk_type', phone: 'full', mark: 'logo' }
  };
  // SiteStaffr_Panel_Look::CORNER_PX; "site" is the 12px used when Match my site has no theme radius.
  var CORNER_PX = { square: 2, soft: 10, round: 20, site: 12 };

  var ICONS = {
    typing: '<path d="M21 11.5a8.5 8.5 0 0 1-9.1 8.5 8.9 8.9 0 0 1-3.5-.8L3 21l1.8-5.4a8.5 8.5 0 0 1-.8-3.6 8.5 8.5 0 0 1 8.5-8.5 8.5 8.5 0 0 1 8.5 8.5z"></path><circle cx="8.5" cy="11.5" r="0.9" fill="currentColor" stroke="none"></circle><circle cx="12" cy="11.5" r="0.9" fill="currentColor" stroke="none"></circle><circle cx="15.5" cy="11.5" r="0.9" fill="currentColor" stroke="none"></circle>',
    bubble: '<path d="M21 11.5a8.5 8.5 0 0 1-9.1 8.5 8.9 8.9 0 0 1-3.5-.8L3 21l1.8-5.4a8.5 8.5 0 0 1-.8-3.6 8.5 8.5 0 0 1 8.5-8.5 8.5 8.5 0 0 1 8.5 8.5z"></path>',
    sparkle: '<path d="M12 2.6l2.1 5.3 5.3 2.1-5.3 2.1L12 17.4l-2.1-5.3-5.3-2.1 5.3-2.1z"></path><path d="M18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"></path><path d="M5 3l.6 1.5L7.1 5l-1.5.6L5 7.1l-.6-1.5L2.9 5l1.5-.6z"></path>',
    waveform: '<line x1="2.5" y1="10" x2="2.5" y2="14"></line><line x1="6.5" y1="6.5" x2="6.5" y2="17.5"></line><line x1="10.5" y1="3" x2="10.5" y2="21"></line><line x1="14.5" y1="8.5" x2="14.5" y2="15.5"></line><line x1="18" y1="5.5" x2="18" y2="18.5"></line><line x1="21.5" y1="10" x2="21.5" y2="14"></line>',
    microphone: '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line>',
    chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>',
    headset: '<path d="M3 18v-6a9 9 0 0 1 18 0v6"></path><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>'
  };

  /* ---------- colors, as SiteStaffr_Widget_Settings_Provider computes them ---------- */

  function rgb(hex) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16); });
  }
  function toHex(c, upper) {
    var s = '#' + c.map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join('');
    return upper ? s.toUpperCase() : s;
  }
  function luminance(hex) {
    var c = rgb(hex);
    return 0.2126 * Math.pow(c[0] / 255, 2.2) + 0.7152 * Math.pow(c[1] / 255, 2.2) + 0.0722 * Math.pow(c[2] / 255, 2.2);
  }
  function isLight(hex) {
    var c = rgb(hex);
    return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255 > 0.55;
  }
  function shade(hex, amount) {
    var to = isLight(hex) ? 0 : 255;
    return toHex(rgb(hex).map(function (v) { return Math.round(v + (to - v) * amount); }), true);
  }
  function textSafeFill(hex) {
    var lum = luminance(hex);
    var k = lum > 0.179 && lum < 0.30 ? Math.pow(0.175 / lum, 0.4545) : 1;
    return toHex(rgb(hex).map(function (v) { return Math.round(v * k); }));
  }
  function wcagInk(hex) { return luminance(hex) > 0.179 ? '#000000' : '#ffffff'; }
  function brandVars(b) {
    return ' --ss-brand: ' + b + '; --ss-brand-rgb: ' + rgb(b).join(', ') + ';' + (isLight(b) ? ' --ss-brand-text: ' + shade(b, 0.5) + ';' : '');
  }
  // SiteStaffr_Panel_Look::short_name()
  function shortName(name) {
    var words = name.trim().split(/\s+/);
    while (words.length > 1 && /^(the|a|an|dr\.?|st\.?)$/i.test(words[0])) words.shift();
    return words[0].length <= 3 || /\.$/.test(words[0]) ? name.trim() : words[0];
  }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ---------- settings ---------- */

  var accentRaw = opt('accent', '#1fb6cc');
  var accent = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(accentRaw) ? toHex(rgb(accentRaw)) : '#1fb6cc';
  var business = opt('business', 'Chat');
  var lookName = LOOKS[opt('look', '')] ? opt('look', '') : 'front_desk';
  var look = LOOKS[lookName];
  var mode = /^(both|text|voice)$/.test(opt('mode', '')) ? opt('mode', '') : 'both';
  var position = opt('position', '') === 'bottom-left' ? 'bottom-left' : 'bottom-right';
  var icon = ICONS[opt('icon', '')] ? opt('icon', '') : 'typing';
  var phone = opt('phone', '');
  var questions = opt('questions', '').split('|').map(function (q) { return q.trim(); }).filter(Boolean);
  var how = { voice: 'by voice', text: 'by text', both: 'by voice or text' }[mode];
  var tooltip = opt('teaser', 'Questions about ' + business + '? Ask ' + how + '.');
  var greeting = opt('greeting', 'Hi! Thanks for reaching out to ' + business + (/\.$/.test(business) ? '' : '.') + ' How can I help you today?');
  var reply = opt('reply', 'Thanks! Could you share a little more detail and the best number to reach you? Someone from our team will follow up.');
  var replyEs = opt('reply-es', '');

  var fill = textSafeFill(accent);
  var ink = wcagInk(fill);
  var siteFont = getComputedStyle(document.body).fontFamily;

  var pill = null;
  if (lookName === 'workshop') pill = { label: { text: 'Text us', voice: 'Talk to us', both: 'Talk or text' }[mode], note: '' };
  if (lookName === 'talk_now' && mode !== 'text') pill = { label: 'Talk to us', note: 'Answering now' };

  var config = {
    look: lookName, start: look.start, questions: questions.slice(0, 3), hours: null, phone: phone,
    mainAction: phone ? { type: 'call' } : null, name: business, short: shortName(business), logo: '', mode: mode,
    greeting: '', talk: '', talkNote: '', type: '', typeNote: '', phoneLine: true
  };
  window.sitestaffr_widget_data = window.sitestaffr_widget_data || {
    chat_greeting: greeting, tooltipBehavior: 'auto', mode: mode, sounds_enabled: true, panel: config, preview: null, entitlement: 'active',
    strings: { idle: 'Talk to AI Assistant', listening: 'Listening...', thinking: 'Processing...', speaking: 'Speaking...', error: 'Error - Please try again', permission: 'Microphone permission required' }
  };

  /* ---------- the launcher, as SiteStaffr_Widget_Render_Handler prints it ---------- */

  var attrs = {
    'data-position': position, 'data-background-color': fill, 'data-icon-color': ink, 'data-size': '60px',
    'data-idle-text': tooltip, 'data-mode': mode, 'data-ss-title': business,
    'data-ss-header': 'brand', 'data-ss-avatar': 'on', 'data-ss-visitor': 'filled', 'data-ss-assistant': 'card',
    'data-ss-background': 'gray', 'data-ss-font': 'standard', 'data-ss-labels': 'regular', 'data-ss-header-color': 'brand',
    'data-ss-visitor-color': 'brand', 'data-ss-ai-color': 'neutral', 'data-ss-surface': 'light',
    'data-ssp-look': lookName, 'data-ssp-bg': look.bg, 'data-ssp-corners': look.corners, 'data-ssp-font': 'site',
    'data-ssp-mark': 'initial', 'data-ssp-start': look.start, 'data-ssp-phone': look.phone, 'data-ssp-beside': 'none',
    'data-ssp-own': '', 'data-ssp-place': 'float'
  };
  var style = '--widget-bg-color: ' + fill + '; --widget-hover-bg-color: ' + fill + '; --widget-icon-color: ' + ink +
    '; --widget-hover-icon-color: ' + ink + '; --widget-size: 60px; --widget-icon-size: 24px; --widget-border-radius: 20px 20px 20px 0px;' +
    ' --widget-bg-rgb: ' + rgb(fill).join(', ') + ';' + (isLight(fill) ? ' --widget-accent-text: ' + shade(fill, 0.5) + ';' : '') +
    ' --ss-corners: 20px;' + brandVars(accent) + brandVars(accent) + (isLight(accent) ? '' : ' --ss-brand-text: initial;') +
    ' --ss-radius: ' + CORNER_PX[look.corners] + 'px;' + (siteFont ? ' --ss-site-font: ' + siteFont + ';' : '');

  var widget = document.createElement('div');
  widget.id = 'sitestaffr-widget';
  widget.className = 'sitestaffr-widget position-' + position + ' sitestaffr-tooltip--auto-dismiss';
  Object.keys(attrs).forEach(function (k) { widget.setAttribute(k, attrs[k]); });
  widget.setAttribute('style', style);
  var svg = '<svg class="sitestaffr-icon sitestaffr-icon-microphone" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">';
  widget.innerHTML =
    '<button type="button" class="sitestaffr-widget-button" aria-label="' + esc(pill ? pill.label : 'Talk to AI Assistant') + '">' +
      '<div class="sitestaffr-pulse-ring"></div>' +
      svg.replace('sitestaffr-icon-microphone', 'sitestaffr-icon-phone').replace('stroke-linejoin="round">', 'stroke-linejoin="round" aria-hidden="true">') + ICONS[icon] + '</svg>' +
      svg + ICONS.microphone + '</svg>' +
      svg.replace('sitestaffr-icon-microphone', 'sitestaffr-icon-spinner') + '<line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>' +
      '<div class="sitestaffr-icon sitestaffr-icon-soundwave"><span></span><span></span><span></span></div>' +
      (pill ? '<span class="sitestaffr-widget-pill"><b>' + esc(pill.label) + '</b><small' + (pill.note ? '' : ' hidden') + '>' + esc(pill.note) + '</small></span>' : '') +
    '</button>' +
    '<div class="sitestaffr-widget-tooltip"><span class="sitestaffr-tooltip-text">' + esc(tooltip) + '</span></div>';

  // sitestaffr-core.js SiteStaffrChatStyle.apply(): the panel is appended to <body>, so the launcher's
  // look reaches it only by copying. sitestaffr-panel.js calls this when it builds the panel.
  var CHAT_STYLE_PROPS = ['--ss-corners', '--ss-radius', '--ss-site-font',
    '--ss-bg-custom', '--ss-bg-ink', '--ss-bg-counter', '--ss-bg-text',
    '--ss-header-custom', '--ss-header-ink', '--ss-header-counter', '--ss-header-text',
    '--ss-visitor-custom', '--ss-visitor-ink', '--ss-visitor-counter', '--ss-visitor-text',
    '--ss-ai-custom', '--ss-ai-ink', '--ss-ai-counter', '--ss-ai-text', '--ss-logo',
    '--ssp-own-bg', '--ssp-own-ink', '--ssp-own-card', '--ssp-own-muted', '--ssp-own-line',
    '--ssp-own-header', '--ssp-own-header-ink', '--ssp-own-buttons', '--ssp-own-buttons-ink',
    '--ssp-own-visitor', '--ssp-own-visitor-ink', '--ssp-own-assistant', '--ssp-own-assistant-ink',
    '--ssp-own-text', '--ssp-own-font'];
  var CHAT_BRAND_PROPS = { '--ss-brand': '--widget-bg-color', '--ss-brand-rgb': '--widget-bg-rgb', '--ss-brand-text': '--widget-accent-text' };
  window.SiteStaffrChatStyle = window.SiteStaffrChatStyle || {
    apply: function (root, el) {
      var cs = getComputedStyle(root);
      CHAT_STYLE_PROPS.forEach(function (p) { var v = cs.getPropertyValue(p).trim(); if (v) el.style.setProperty(p, v); });
      Object.keys(CHAT_BRAND_PROPS).forEach(function (p) { var v = cs.getPropertyValue(p).trim(); if (v) el.style.setProperty(CHAT_BRAND_PROPS[p], v); });
      Array.prototype.forEach.call(root.attributes, function (a) {
        if (a.name.indexOf('data-ss-') === 0 || a.name.indexOf('data-ssp-') === 0) el.setAttribute(a.name, a.value);
      });
    }
  };

  /* ---------- the plugin's files ---------- */

  ['sitestaffr-widget.css', 'sitestaffr-chat-panel.css', 'sitestaffr-panel-looks.css'].forEach(function (f) {
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = base + f;
    document.head.appendChild(l);
  });
  var script = document.createElement('script');
  script.src = base + 'sitestaffr-panel.js';
  script.onload = boot;
  document.head.appendChild(script);

  /* ---------- the widget's behavior (sitestaffr-widget.js, without the server) ---------- */

  var P, panel = null, isOpen = false, chatStarted = false, state = 'idle', timers = [];
  var button = widget.querySelector('.sitestaffr-widget-button');
  var tipText = widget.querySelector('.sitestaffr-tooltip-text');

  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  function setState(next) {
    widget.classList.remove('state-' + state);
    state = next;
    widget.classList.add('state-' + state);
    var text = { connecting: 'Connecting to AI Assistant...', listening: 'Listening...', speaking: 'Speaking...', thinking: 'Processing...' }[state];
    tipText.textContent = text || tooltip;
  }

  function create() {
    if (panel) return panel;
    panel = new P.Panel({
      root: widget, config: config, canTalk: mode !== 'text', canType: mode !== 'voice', soundsEnabled: true, position: position,
      onTalk: talk,
      onType: startText,
      onTellUs: startText,
      onAsk: function (q) { startText(); send(q); },
      onCallType: function () { endCall(); startText(); },
      onCallEnd: endCall,
      onClose: close,
      onMute: function (btn) {
        var muted = !btn.classList.contains('is-muted');
        btn.innerHTML = P.icon(muted ? 'volOff' : 'vol', 18);
        btn.classList.toggle('is-muted', muted);
      },
      onSend: function () { send(); },
      onInput: function () {},
      onNotice: function () {}
    });
    return panel;
  }

  function show(screen) {
    create();
    panel.show(screen);
    if (isOpen) return;
    widget.classList.add('panel-open');
    panel.open();
    isOpen = true;
  }

  function close() {
    endCall();
    clearTimers();
    if (panel) {
      panel.close();
      panel.resetContact();
    }
    widget.classList.remove('panel-open');
    isOpen = false;
    chatStarted = false;
  }

  function messages() { return panel.el.querySelector('.sitestaffr-chat-messages'); }
  function typing(on) { panel.el.querySelector('.sitestaffr-chat-typing').classList.toggle('is-visible', on); scroll(); }
  function scroll() { var m = messages(); m.scrollTop = m.scrollHeight; }

  function append(role, text) {
    var body = role === 'user' ? text : '<p>' + esc(text) + '</p>';
    if (panel.labelsTurns()) {
      panel.addMessage(role, body);
    } else {
      var bubble = document.createElement('div');
      bubble.className = 'sitestaffr-chat-message sitestaffr-chat-message--' + (role === 'user' ? 'visitor' : 'assistant');
      if (role === 'user') bubble.textContent = text;
      else bubble.innerHTML = body;
      messages().insertBefore(bubble, messages().querySelector('.sitestaffr-chat-typing'));
    }
    scroll();
  }

  function startText() {
    show('text');
    if (!chatStarted) {
      var list = messages();
      Array.prototype.slice.call(list.children).forEach(function (n) {
        if (!n.classList.contains('sitestaffr-chat-typing')) n.remove();
      });
      typing(false);
      append('assistant', greeting);
      chatStarted = true;
    }
    var field = panel.el.querySelector('.sitestaffr-chat-textarea');
    setTimeout(function () { field.focus(); }, 300);
  }

  function send(question) {
    var field = panel.el.querySelector('.sitestaffr-chat-textarea');
    var text = (question || field.value).trim();
    if (!text) return;
    if (!chatStarted || panel.screen !== 'text') startText();
    append('user', text);
    if (!question) {
      field.value = '';
      field.style.height = 'auto';
    }
    later(function () { typing(true); }, 350);
    later(function () {
      typing(false);
      append('assistant', replyEs && /espa|hola|ayuda|gracias|necesito|tengo|cucarach|hormiga|termita/i.test(text) ? replyEs : reply);
    }, 2000);
  }

  function talk() {
    if (mode === 'text') return;
    clearTimers();
    chatStarted = false;
    create();
    if (!isOpen) show('start');
    panel.beginCall({ resumed: false });
    setState('connecting');
    later(function () {
      setState('listening');
      panel.setCall({ state: 'listening' });
    }, 1200);
    later(endCall, 7200);
  }

  function endCall() {
    if (state === 'idle') return;
    clearTimers();
    setState('idle');
    if (panel && panel.screen === 'call') panel.abortCall();
  }

  function boot() {
    P = window.SiteStaffrPanel;
    document.body.appendChild(widget);

    var tip = widget.querySelector('.sitestaffr-widget-tooltip');
    tip.addEventListener('animationend', function () { widget.classList.remove('sitestaffr-tooltip--auto-dismiss'); }, { once: true });

    button.addEventListener('click', function () {
      // A phone half sheet closes only from its close button (#358): the launcher expands it instead.
      var sheet = P.openPhoneSheet && P.openPhoneSheet();
      if (sheet) { if (sheet === panel) sheet.expandSheet(); return; }
      if (state !== 'idle' && panel) { show('call'); return; }
      if (isOpen) close();
      else show('start');
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen) close();
    });

    // The phone layout reads the visual viewport (sitestaffr-widget.js VisualViewportSync).
    var vv = window.visualViewport;
    if (vv) {
      var sync = function () {
        var root = document.documentElement;
        if (!window.matchMedia('(max-width: 480px)').matches) {
          root.style.removeProperty('--ss-vv-height');
          root.style.removeProperty('--ss-vv-top');
          return;
        }
        root.style.setProperty('--ss-vv-height', vv.height + 'px');
        root.style.setProperty('--ss-vv-top', vv.offsetTop + 'px');
      };
      vv.addEventListener('resize', sync);
      vv.addEventListener('scroll', sync);
      sync();
    }
  }
})();
