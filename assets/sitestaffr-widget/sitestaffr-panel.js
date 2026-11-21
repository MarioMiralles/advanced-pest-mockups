/**
 * The chat panel (#395): one module for the floating widget and in-page buttons.
 *
 * `model` is the look/override arithmetic, shared by the widget and the owner's screen.
 * The looks table always comes from the server (SiteStaffr_Panel_Look::LOOKS); this file
 * never holds a copy, so PHP and JS cannot drift.
 */
(function (root) {
	'use strict';

	const CONTROL_KEYS = ['panel_color', 'panel_background', 'panel_corners', 'panel_font', 'panel_mark',
		'panel_start', 'panel_phone', 'panel_questions', 'panel_hours', 'panel_beside',
		'panel_bg_color', 'panel_header', 'panel_buttons', 'panel_visitor', 'panel_assistant', 'panel_text',
		'panel_greeting', 'panel_talk', 'panel_talk_note', 'panel_type', 'panel_type_note', 'panel_phone_line',
		'panel_questions_fill', 'panel_questions_hidden', 'panel_questions_kept', 'panel_desktop'];
	// What a look sets, and what never changes with one (#598): SiteStaffr_Panel_Look::STYLE_KEYS / KEPT_KEYS.
	const STYLE_KEYS = ['panel_background', 'panel_corners', 'panel_start', 'panel_phone', 'panel_hours', 'panel_beside',
		'panel_bg_color', 'panel_header', 'panel_buttons', 'panel_visitor', 'panel_assistant', 'panel_text'];
	const KEPT_KEYS = ['panel_color', 'panel_font', 'panel_mark', 'panel_questions',
		'panel_greeting', 'panel_talk', 'panel_talk_note', 'panel_type', 'panel_type_note', 'panel_phone_line',
		'panel_questions_fill', 'panel_questions_hidden', 'panel_questions_kept', 'panel_desktop'];

	/* ---------- the owner's colors (#609): SiteStaffr_Panel_Look::mix() / contrast() / surface_hex() ---------- */

	const longHex = (hex) => {
		const h = String(hex || '').replace(/^#/, '').toLowerCase();
		return '#' + (h.length === 3 ? h.split('').map((c) => c + c).join('') : h);
	};
	const rgbOf = (hex) => longHex(hex).slice(1).match(/../g).map((x) => parseInt(x, 16));

	/** `t` of color a over b, per channel in sRGB (CSS color-mix in srgb). */
	function mixHex(a, b, t) {
		const x = rgbOf(a);
		const y = rgbOf(b);
		return '#' + x.map((v, i) => {
			const n = Math.round(v * t + y[i] * (1 - t));
			return (n < 16 ? '0' : '') + n.toString(16);
		}).join('');
	}

	/** WCAG luminance with the gamma 2.2 approximation (SiteStaffr_Widget_Settings_Provider::luminance()). */
	function luminance(hex) {
		const [r, g, b] = rgbOf(hex);
		return 0.2126 * Math.pow(r / 255, 2.2) + 0.7152 * Math.pow(g / 255, 2.2) + 0.0722 * Math.pow(b / 255, 2.2);
	}

	function contrast(a, b) {
		const la = luminance(a);
		const lb = luminance(b);
		return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
	}

	/** Black or white, whichever reads on the color (wcag_ink()). */
	const inkFor = (hex) => (luminance(hex) > 0.179 ? '#000000' : '#ffffff');

	/** The window's background as visitors see it, for resolved settings and the main color. */
	function surfaceHex(r, brand) {
		if (r.panel_bg_color && r.panel_bg_color !== 'main') return longHex(r.panel_bg_color);
		const presets = { light: ['#ffffff', 0.035], tinted: ['#fbfaf8', 0.05], dark: ['#10161c', 0.14] };
		const p = presets[r.panel_background] || presets.light;
		return mixHex(brand, p[0], p[1]);
	}

	function overrides(settings) {
		const raw = (settings && settings.panel_overrides) || '';
		const keys = raw.split(',').map((k) => k.trim());
		return CONTROL_KEYS.filter((k) => keys.indexOf(k) !== -1);
	}

	function withOverrides(settings, list) {
		return Object.assign({}, settings, { panel_overrides: CONTROL_KEYS.filter((k) => list.indexOf(k) !== -1).join(',') });
	}

	function lookName(looks, settings) {
		const name = settings && settings.panel_look;
		return looks[name] ? name : 'front_desk';
	}

	function resolve(looks, settings) {
		const look = lookName(looks, settings || {});
		const values = Object.assign({ panel_look: look }, looks[look]);
		overrides(settings || {}).forEach((k) => {
			if (Object.prototype.hasOwnProperty.call(settings, k)) values[k] = settings[k];
		});
		return values;
	}

	/** Is this value the owner's own under that look? A picked color always is. */
	function differs(look, key, value) {
		return key === 'panel_color' ? value !== 'site' : String(look[key]) !== String(value);
	}

	/** The owner's changes from the look ("N changes from <look>"): the style keys that differ, in order. */
	function changes(looks, settings) {
		const r = resolve(looks, settings);
		const look = looks[r.panel_look];
		return STYLE_KEYS.filter((k) => String(r[k]) !== String(look[k]));
	}

	/**
	 * Choose a look: its style replaces the owner's, and color, logo, font and questions stay as they
	 * are (SiteStaffr_Panel_Look::switch_look()). `undo` is the settings as they were.
	 */
	function switchLook(looks, settings, look) {
		const before = resolve(looks, settings);
		const name = lookName(looks, { panel_look: look });
		const target = looks[name];
		const next = Object.assign({}, settings, { panel_look: name });
		STYLE_KEYS.forEach((k) => { next[k] = target[k]; });
		const list = [];
		KEPT_KEYS.forEach((k) => {
			next[k] = before[k];
			if (differs(target, k, before[k])) list.push(k);
		});
		return { settings: withOverrides(next, list), undo: Object.assign({}, settings) };
	}

	/** Back to <look>: the look's style again; the kept keys stay the owner's. */
	function backToLook(looks, settings) {
		return switchLook(looks, settings, lookName(looks, settings)).settings;
	}

	function setControl(looks, settings, key, value) {
		const look = looks[lookName(looks, settings)];
		const next = Object.assign({}, settings, { [key]: value });
		const list = overrides(settings).filter((k) => k !== key);
		if (differs(look, key, value)) list.push(key);
		return withOverrides(next, list);
	}

	/* ---------- rendering (Phase 2) ---------- */

	const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
	const DOT = ' · ';

	/**
	 * The page's language (#703, #766): the server sends `words` (English text -> the page's language) only
	 * on a page in a language SiteStaffr carries other than English. Without them every word below is the
	 * English it always was.
	 */
	let WORDS = null;
	function useWords(words) {
		WORDS = words && typeof words === 'object' && !Array.isArray(words) ? words : null;
	}
	function t(text, fallback) {
		if (WORDS && Object.prototype.hasOwnProperty.call(WORDS, text)) return String(WORDS[text]);
		return fallback === undefined ? text : fallback;
	}
	/** sprintf's %s and %1$s / %2$s, in the order given. */
	function fmt(template) {
		const args = Array.prototype.slice.call(arguments, 1);
		let i = 0;
		return String(template).replace(/%(?:(\d)\$)?s/g, (m, pos) => String(args[pos ? Number(pos) - 1 : i++]));
	}
	/**
	 * The parts a fmt() template filled in, or null: `parts` are the regex for %1$s, %2$s... (or each %s in
	 * turn), and come back in that order, wherever the language puts them ("mở cửa lúc %2$s %1$s", #766).
	 */
	function unfmt(template, text, parts) {
		let i = 0;
		const order = [];
		const source = String(template).split(/(%(?:\d\$)?s)/).map((piece) => {
			const hole = /^%(?:(\d)\$)?s$/.exec(piece);
			if (!hole) return piece.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			const at = hole[1] ? Number(hole[1]) - 1 : i++;
			order.push(at);
			return '(' + parts[at] + ')';
		}).join('');
		const m = new RegExp('^' + source + '$').exec(String(text || ''));
		if (!m) return null;
		const out = [];
		order.forEach((at, k) => { out[at] = m[k + 1]; });
		return out;
	}
	const pad = (n) => (n < 10 ? '0' : '') + n;
	const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
		.replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

	// Lucide-style strokes, copied from the approved gallery (assets/mock.js).
	const ICONS = {
		mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/>',
		chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
		send: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>',
		x: '<path d="M18 6 6 18M6 6l12 12"/>',
		vol: '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/>',
		volOff: '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="m23 9-6 6M17 9l6 6"/>',
		phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.9.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
		chev: '<path d="m9 18 6-6-6-6"/>',
		check: '<path d="M20 6 9 17l-5-5"/>',
		edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
		lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
		arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
		cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
		clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
		pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
		tag: '<path d="M12 2H2v10l9.3 9.3a1 1 0 0 0 1.4 0l8.6-8.6a1 1 0 0 0 0-1.4z"/><circle cx="7" cy="7" r="1.5"/>',
		micOff: '<path d="M2 2l20 20"/><path d="M18.9 13.9A7 7 0 0 0 19 12v-2"/><path d="M5 10v2a7 7 0 0 0 12 5"/><path d="M15 9.3V5a3 3 0 0 0-5.7-1.3"/><path d="M9 9v3a3 3 0 0 0 5.1 2.1"/><path d="M12 19v3"/>',
		kbd: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>'
	};
	const icon = (name, size, width) => '<svg class="sitestaffr-panel-icon" viewBox="0 0 24 24" width="' + (size || 20) + '" height="' + (size || 20) +
		'" fill="none" stroke="currentColor" stroke-width="' + (width || 2) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + ICONS[name] + '</svg>';

	const KEYPAD = { A: 2, B: 2, C: 2, D: 3, E: 3, F: 3, G: 4, H: 4, I: 4, J: 5, K: 5, L: 5, M: 6, N: 6, O: 6, P: 7, Q: 7, R: 7, S: 7, T: 8, U: 8, V: 8, W: 9, X: 9, Y: 9, Z: 9 };

	/**
	 * A tel: link for a business phone, or '' when it is not dialable. Vanity letters become keypad
	 * digits ("1-800-FLOWERS"), an extension ("ext 12", "x204", "#55") is cut off the number and
	 * carried as ";ext=", and fewer than seven digits is not a phone number.
	 */
	function telHref(phone) {
		const raw = String(phone == null ? '' : phone).trim();
		const ext = raw.match(/(?:^|[\s,])(?:ext\.?|extension|x|#)\s*(\d+)\s*$/i);
		const main = ext ? raw.slice(0, ext.index) : raw;
		const digits = main.toUpperCase().replace(/[A-Z]/g, (c) => KEYPAD[c]).replace(/(?!^\+)[^\d]/g, '');
		if (digits.replace(/\D/g, '').length < 7) return '';
		return 'tel:' + digits + (ext ? ';ext=' + ext[1] : '');
	}

	function localParts(now, tz, offset) {
		try {
			const parts = {};
			new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
				.formatToParts(now).forEach((p) => { parts[p.type] = p.value; });
			return { day: parts.weekday.toLowerCase().slice(0, 3), hm: parts.hour + ':' + parts.minute };
		} catch (e) {
			// WordPress stores a manual UTC offset as "+05:00"; engines reject it as a time zone.
			const d = new Date(now.getTime() + (offset || 0) * 60000);
			return { day: DAYS[(d.getUTCDay() + 6) % 7], hm: pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) };
		}
	}

	/** End a sentence with a period unless it already ends in . ! or ? (a business name can end in "P.A."). PHP twin: SiteStaffr_Text::end_sentence(). */
	function endSentence(text) {
		const t = String(text == null ? '' : text).replace(/\s+$/, '');
		return t === '' || /[.!?。！？؟]$/.test(t) ? t : t + '.';
	}

	function clock(hm) {
		const [h, m] = hm.split(':').map(Number);
		// A 24-hour language (#766) names its clock: "%Hh" and "%Hh%M" give "9h" and "9h30".
		const own = t(m ? 'clock:hourmin' : 'clock:hour', '');
		if (own) return own.replace(/%HH/g, pad(h)).replace(/%H/g, String(h)).replace(/%M/g, pad(m));
		const h12 = h % 12 || 12;
		return (m ? h12 + ':' + pad(m) : String(h12)) + (h >= 12 ? t(' PM') : t(' AM'));
	}

	/** Same open/closed rule as SiteStaffr_Business_Hours::is_after_hours(): start inclusive, end exclusive, end <= start wraps. */
	function hoursLine(hours, now) {
		// clock === false: the site never set its time zone, so "now" would be read on UTC (#696).
		if (!hours || !hours.schedule || hours.clock === false) return '';
		const s = hours.schedule;
		const { day, hm } = localParts(now, hours.tz, hours.offset);
		const today = s[day];
		if (today && today.open && today.start && today.end) {
			const wraps = today.end <= today.start;
			const open = wraps ? (hm >= today.start || hm < today.end) : (hm >= today.start && hm < today.end);
			if (open) return oneOClock(t('Open now') + DOT + fmt(t('until %s'), clock(today.end)));
			if (hm < today.start) return oneOClock(t('Closed') + DOT + fmt(t('opens %s'), clock(today.start)));
		}
		const i = DAYS.indexOf(day);
		for (let k = 1; k <= 7; k++) {
			const d = DAYS[(i + k) % 7];
			const next = s[d];
			if (next && next.open && next.start) {
				const when = k === 1 ? t('tomorrow') : t('day:' + d, d.charAt(0).toUpperCase() + d.slice(1));
				return oneOClock(t('Closed') + DOT + fmt(t('opens %1$s %2$s'), when, clock(next.start)));
			}
		}
		return '';
	}

	/** Spanish says "a la 1", not "a las 1". */
	function oneOClock(text) {
		return WORDS ? text.replace(/\blas 1(?=[: ])/g, 'la 1') : text;
	}

	/** Is this hours line the open one? */
	function isOpenLine(text) {
		return String(text || '').indexOf(t('Open now')) === 0;
	}

	/**
	 * Escaped hours text whose time phrases never split (#615): "Open now", "until 6 PM" and "opens tomorrow
	 * 9 AM" each stay on one line, so the line wraps only between them, at a dot.
	 */
	function keepTimes(text) {
		// In the page's language each piece between the dots stays whole, which is what the English rule does.
		if (WORDS) return esc(text).split(esc(DOT)).map((piece) => piece.replace(/ /g, '\u00a0')).join(esc(DOT));
		return esc(text).replace(/ (AM|PM)\b/g, '\u00a0$1')
			.replace(/Open now|(?:opens|until)(?: (?:tomorrow|[A-Z][a-z]{2}))? \d{1,2}(?::\d\d)?\u00a0(?:AM|PM)/g, (m) => m.replace(/ /g, '\u00a0'));
	}

	// The AI disclosure is a literal (#250): no control reaches it. Hours may follow it, never replace it.
	/** The AI disclosure and the hours. The line may wrap on a phone, between pieces only (keepTimes). */
	function subtitleHtml(hoursText) {
		return '<i class="sitestaffr-panel-live" aria-hidden="true"></i>' + esc(t('AI assistant')) + (hoursText ? DOT + keepTimes(hoursText) : '');
	}

	function cssUrl(url) {
		// encodeURI turns a literal % into %25, which would corrupt a URL that is already encoded (%20 -> %2520); put valid %XX escapes back.
		return esc(encodeURI(String(url)).replace(/%25([0-9A-Fa-f]{2})/g, '%$1').replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29'));
	}

	function headerHtml(config, mark, hoursText, soundsEnabled, canTalk) {
		const name = String(config.name || t('Chat'));
		let markHtml = '';
		if (mark === 'logo' && config.logo) {
			markHtml = '<span aria-hidden="true" class="sitestaffr-panel-mark is-logo" style="background-image:url(' + cssUrl(config.logo) + ')"></span>';
		} else if (mark !== 'none') {
			markHtml = '<span aria-hidden="true" class="sitestaffr-panel-mark">' + esc((Array.from(name)[0] || '').toUpperCase()) + '</span>';
		}
		// Workshop keeps the hours in a status strip under the header, so the AI line stays the bare disclosure.
		// (Blueprint's first screen carries them in its title block: refreshHours() keeps them out of the header there.)
		const workshop = config.look === 'workshop';
		return '<div class="sitestaffr-chat-header sitestaffr-panel-header">' + markHtml +
			'<div class="sitestaffr-chat-header-identity">' +
				'<span class="sitestaffr-chat-header-title">' + esc(name) + '</span>' +
				'<span class="sitestaffr-chat-header-subtitle">' + subtitleHtml(workshop ? '' : hoursText) + '</span>' +
			'</div>' +
			'<div class="sitestaffr-chat-header-actions">' +
				// Voice first keeps a way back to the call on the text screen; the stylesheet shows it there only.
				(canTalk && config.start === 'voice_first' ? '<button type="button" class="sitestaffr-panel-back" data-panel-action="talk" title="' + esc(t('Talk instead')) + '">' + icon('mic', 15, 2.2) + '<span>' + esc(t('Talk instead')) + '</span></button>' : '') +
				(soundsEnabled ? '<button type="button" class="sitestaffr-chat-header-btn sitestaffr-chat-mute-btn" aria-label="' + esc(t('Toggle sounds')) + '">' + icon('vol', 18) + '</button>' : '') +
				'<button type="button" class="sitestaffr-chat-header-btn sitestaffr-chat-close-btn" aria-label="' + esc(t('Close chat')) + '">' + icon('x', 18) + '</button>' +
			'</div></div>' + (workshop ? statusHtml(hoursText) : '');
	}

	/** Workshop's strip under the header: the live hours line, lit while the business is open. Empty when there are no hours. */
	function statusHtml(text) {
		if (!text) return '';
		return '<div class="sitestaffr-panel-status' + (isOpenLine(text) ? ' is-open' : '') + '"><i aria-hidden="true"></i><span>' + keepTimes(text) + '</span></div>';
	}

	/**
	 * The first screen: Talk (only when the visitor may talk) and Type side by side, up to three
	 * common questions, and the business phone. `canType: false` is a legacy Voice only site,
	 * which has no text chat to send a question to.
	 */
	/** A practice's line asking visitors not to share medical details (plugin #765), or ''. */
	function healthNote() {
		const data = root.sitestaffr_widget_data || root.sitestaffr_button_data;
		return data && data.health_note ? String(data.health_note) : '';
	}

	function startHtml(config, opts) {
		// The owner hid the phone line (#609): no Prefer to call, no Call us on this screen.
		if (config.phoneLine === false && config.phone) config = Object.assign({}, config, { phone: '' });
		// The First screen control picks the screen on any look; the look only styles it. Voice first needs a
		// visitor who can talk: a Type only site gets the look's own Talk and type screen without Talk.
		if (config.start === 'voice_first' && opts && opts.canTalk) return talkNowStartHtml(config, opts);
		if (config.start === 'main_actions') {
			// With nothing to offer (no way to talk, none to type, no phone) the rows would be an empty list.
			const sheet = quickSheetStartHtml(config, opts);
			if (sheet) return sheet;
		}
		if (config.look === 'concierge') return conciergeStartHtml(config, opts);
		if (config.look === 'workshop') return workshopStartHtml(config, opts);
		if (config.look === 'poster') return posterStartHtml(config, opts);
		if (config.look === 'blueprint') return blueprintStartHtml(config, opts);
		if (config.look === 'sketch') return sketchStartHtml(config, opts);
		const canTalk = !!(opts && opts.canTalk);
		const canType = !opts || opts.canType !== false;
		const questions = canType ? (config.questions || []).slice(0, 3) : [];
		const phone = config.phone ? String(config.phone) : '';
		const tel = telHref(phone);
		return '<div class="sitestaffr-panel-start">' +
			'<h3 class="sitestaffr-panel-greeting">' + word(config, 'greeting', 'Hi! How can we help?') + '</h3>' +
			'<div class="sitestaffr-panel-modes">' +
				(canTalk ? '<button type="button" class="sitestaffr-panel-mode is-primary" data-panel-action="talk">' + icon('mic', 22) + '<span><b>' + word(config, 'talk', 'Talk') + '</b><small>' + word(config, 'talkNote', 'Speak, hands-free') + '</small></span></button>' : '') +
				(canType ? '<button type="button" class="sitestaffr-panel-mode" data-panel-action="type">' + icon('chat', 22) + '<span><b>' + word(config, 'type', 'Type') + '</b><small>' + word(config, 'typeNote', 'Chat by text') + '</small></span></button>' : '') +
			'</div>' +
			(questions.length ? '<p class="sitestaffr-panel-label">' + esc(t('Common questions')) + '</p><div class="sitestaffr-panel-questions">' +
				questions.map((q) => '<button type="button" class="sitestaffr-panel-question" data-question="' + esc(q) + '">' + '<span class="sitestaffr-panel-question-text">' + esc(q) + '</span>' + icon('chev', 16) + '</button>').join('') + '</div>' : '') +
			(tel ? '<a class="sitestaffr-panel-call-line" href="' + esc(tel) + '">' + icon('phone', 16) + esc(t('Prefer to call?')) + ' <b>' + esc(phone) + '</b></a>' : '') +
			'</div>';
	}

	/**
	 * The owner's words for one place on the first screen (#609, mockup 4), escaped, or the look's own
	 * (trusted HTML) when they left it empty.
	 */
	function word(config, key, fallback) {
		const text = String((config && config[key]) || '').trim();
		return text ? esc(text) : esc(t(fallback));
	}

	/* ---------- Concierge: no bubbles, speaker labels, a quiet first screen ---------- */

	/** The visitor's own clock, not the server's: a page cached at noon still greets the evening visitor correctly. */
	function greetingFor(now) {
		const h = now.getHours();
		return t(h < 12 ? 'Good morning.' : (h < 17 ? 'Good afternoon.' : 'Good evening.'));
	}

	/** The label above the assistant's turns: the short name the server resolved ("Ashgrove"), else the full name. */
	function shortName(config) {
		return String((config && (config.short || config.name)) || '').trim() || t('Assistant');
	}

	/**
	 * One chat message. `body` is trusted HTML for the assistant (the widgets' markdown renderer
	 * already escaped it) and plain text for the visitor, which this escapes, exactly as the
	 * widgets' textContent did. Every look but Concierge gets the bare bubble the widgets always
	 * built; Concierge wraps it in a turn with a speaker label above it.
	 * opts: { look, shortName }
	 */
	function messageHtml(role, body, opts) {
		const side = role === 'user' ? 'visitor' : 'assistant';
		const bubble = '<div class="sitestaffr-chat-message sitestaffr-chat-message--' + side + '">' +
			(role === 'user' ? esc(body) : String(body == null ? '' : body)) + '</div>';
		if (!opts || opts.look !== 'concierge') return bubble;
		return '<div class="sitestaffr-panel-turn sitestaffr-panel-turn--' + side + '"><div class="sitestaffr-panel-who">' +
			esc(role === 'user' ? t('You') : (opts.shortName || t('Assistant'))) + '</div>' + bubble + '</div>';
	}

	function conciergeStartHtml(config, opts) {
		const canTalk = !!(opts && opts.canTalk);
		const canType = !opts || opts.canType !== false;
		const questions = canType ? (config.questions || []).slice(0, 3) : [];
		const phone = config.phone ? String(config.phone) : '';
		const tel = telHref(phone);
		const way = (action, iconName, title, note) => '<button type="button" class="sitestaffr-panel-mode" data-panel-action="' + action + '">' +
			icon(iconName, 20, 1.6) + '<span><b>' + title + '</b><small>' + note + '</small></span>' + icon('arrow', 18, 1.6) + '</button>';
		return '<div class="sitestaffr-panel-start">' +
			'<h3 class="sitestaffr-panel-greeting"' + (config.greeting ? ' data-panel-own' : '') + '>' + (String(config.greeting || '').trim() ? esc(String(config.greeting).trim()) : esc(greetingFor(new Date()))) + '</h3>' +
			'<div class="sitestaffr-panel-modes">' +
				(canTalk ? way('talk', 'mic', word(config, 'talk', 'Speak with us'), word(config, 'talkNote', 'A short voice conversation')) : '') +
				(canType ? way('type', 'edit', word(config, 'type', 'Write to us'), word(config, 'typeNote', 'Ask by text, at your pace')) : '') +
			'</div>' +
			(questions.length ? '<p class="sitestaffr-panel-label">' + esc(t('Often asked')) + '</p><ol class="sitestaffr-panel-questions">' +
				questions.map((q) => '<li><button type="button" class="sitestaffr-panel-question" data-question="' + esc(q) + '"><span class="sitestaffr-panel-question-text">' + esc(q) + '</span></button></li>').join('') + '</ol>' : '') +
			(tel ? '<a class="sitestaffr-panel-call-line" href="' + esc(tel) + '">' + esc(t('Or call the office at')) + ' <b>' + esc(phone) + '</b></a>' : '') +
			'</div>';
	}

	/* ---------- Workshop: big tiles, jump-to actions, the hours ---------- */

	const cap = (word) => word.charAt(0).toUpperCase() + word.slice(1);

	/** "Mon–Fri 7:30 AM–6 PM · Sat 8 AM–1 PM": consecutive days with the same hours share a range; closed days are left out. */
	function hoursSummary(hours) {
		if (!hours || !hours.schedule) return '';
		const groups = [];
		DAYS.forEach((day, i) => {
			const d = hours.schedule[day];
			if (!d || !d.open || !d.start || !d.end) return;
			const span = clock(d.start) + '–' + clock(d.end);
			const last = groups[groups.length - 1];
			if (last && last.span === span && last.to === i - 1) last.to = i;
			else groups.push({ from: i, to: i, span });
		});
		const day = (d) => t('dd:' + d, cap(d));
		return groups.map((g) => day(DAYS[g.from]) + (g.to > g.from ? '–' + day(DAYS[g.to]) : '') + ' ' + g.span).join(DOT);
	}

	/**
	 * Workshop's "Or jump straight to" list, in order, at most four, each only when it exists: the main
	 * action, a price question, hours and directions, a call. A visitor on a Voice only site has no text
	 * chat to ask in, so only the call survives there. A form starts a chat that opens with the form's
	 * name: the floating panel has no Guided Form runtime of its own, only the form's own button does.
	 */
	function jumpActions(config, opts) {
		const canType = !opts || opts.canType !== false;
		const main = config.mainAction;
		const tel = telHref(config.phone);
		const call = tel ? { id: 'call', label: t('Call us'), icon: 'phone', href: tel } : null;
		const out = [];
		// Only the call can be a main action: a Guided Form runs as its own button's conversation, which this
		// panel cannot start, and its title must never be sent as a message.
		if (main && main.type === 'call' && call) out.push(call);
		if (canType) {
			out.push({ id: 'price', label: t('Get a price'), icon: 'tag', question: t('How much does it cost?') });
			out.push({ id: 'where', label: t('Hours & directions'), icon: 'pin', question: t('Where are you located and when are you open?') });
		}
		if (call && out.indexOf(call) === -1) out.push(call);
		return out.slice(0, 4);
	}

	function workshopStartHtml(config, opts) {
		const canTalk = !!(opts && opts.canTalk);
		const canType = !opts || opts.canType !== false;
		const jumps = jumpActions(config, opts);
		const summary = hoursSummary(config.hours);
		const tile = (action, iconName, title, note, primary) => '<button type="button" class="sitestaffr-panel-mode' + (primary ? ' is-primary' : '') + '" data-panel-action="' + action + '">' +
			icon(iconName, 30, 2.2) + '<b>' + title + '</b><small>' + note + '</small></button>';
		const jump = (a) => a.href
			? '<a class="sitestaffr-panel-jump" href="' + esc(a.href) + '">' + icon(a.icon, 22) + '<span>' + esc(a.label) + '</span></a>'
			: '<button type="button" class="sitestaffr-panel-jump" data-panel-action="ask" data-question="' + esc(a.question) + '">' + icon(a.icon, 22) + '<span>' + esc(a.label) + '</span></button>';
		return '<div class="sitestaffr-panel-start">' +
			'<div class="sitestaffr-panel-modes">' +
				(canTalk ? tile('talk', 'mic', word(config, 'talk', 'Talk'), word(config, 'talkNote', 'Hands full? Just talk.'), true) : '') +
				(canType ? tile('type', 'chat', word(config, 'type', 'Text'), word(config, 'typeNote', 'Type it out.'), false) : '') +
			'</div>' +
			(jumps.length ? '<p class="sitestaffr-panel-label">' + esc(t('Or jump straight to')) + '</p><div class="sitestaffr-panel-jumps">' + jumps.map(jump).join('') + '</div>' : '') +
			(summary ? '<div class="sitestaffr-panel-hours-block">' + icon('clock', 18) + '<span><small>' + esc(t('Hours')) + '</small>' + esc(summary) + '</span></div>' : '') +
			'</div>';
	}

	/* ---------- Poster, Blueprint, Sketch (#626): one way to talk, one to type, each question a button ---------- */

	/** A question button with what follows its words (an arrow). The questions wrap whole in these looks. */
	function questionHtml(q, after) {
		return '<button type="button" class="sitestaffr-panel-question" data-question="' + esc(q) + '"><span class="sitestaffr-panel-question-text">' + esc(q) + '</span>' + (after || '') + '</button>';
	}

	/** The first-screen call link, with the look's own words before the number. '' without a dialable phone. */
	function callLineHtml(config, words) {
		const phone = config.phone ? String(config.phone) : '';
		const tel = telHref(phone);
		return tel ? '<a class="sitestaffr-panel-call-line" href="' + esc(tel) + '">' + icon('phone', 16) + words + ' <b>' + esc(phone) + '</b></a>' : '';
	}

	/** Poster: heavy type, black outlines and hard shadows; one way in per row (round 1, mockup 4). */
	function posterStartHtml(config, opts) {
		const canTalk = !!(opts && opts.canTalk);
		const canType = !opts || opts.canType !== false;
		const questions = canType ? (config.questions || []).slice(0, 3) : [];
		const way = (action, primary, iconName, title, note) => '<button type="button" class="sitestaffr-panel-mode' + (primary ? ' is-primary' : '') + '" data-panel-action="' + action + '">' +
			icon(iconName, 24) + '<span><b>' + title + '</b><small>' + note + '</small></span>' + icon('arrow', 22) + '</button>';
		return '<div class="sitestaffr-panel-start">' +
			'<h3 class="sitestaffr-panel-greeting">' + word(config, 'greeting', 'Hi! How can we help?') + '</h3>' +
			'<div class="sitestaffr-panel-modes">' +
				(canTalk ? way('talk', true, 'mic', word(config, 'talk', 'Talk to us'), word(config, 'talkNote', 'Speak, hands-free')) : '') +
				(canType ? way('type', !canTalk, 'chat', word(config, 'type', 'Type to us'), word(config, 'typeNote', 'Chat by text')) : '') +
			'</div>' +
			(questions.length ? '<p class="sitestaffr-panel-label">' + esc(t('Quick questions')) + '</p><div class="sitestaffr-panel-questions">' + questions.map((q) => questionHtml(q)).join('') + '</div>' : '') +
			callLineHtml(config, esc(t('Call'))) +
			'</div>';
	}

	/** Blueprint's title block: the phone and today's hours, one cell each. '' when it has neither. */
	function titleBlockHtml(config, hoursText) {
		const phone = config.phone ? String(config.phone) : '';
		const tel = telHref(phone);
		const cells = (tel ? '<a class="sitestaffr-panel-tb-cell is-call" href="' + esc(tel) + '"><small>' + esc(t('Call')) + '</small><b>' + icon('phone', 15) + esc(phone) + '</b></a>' : '') +
			(hoursText ? '<div class="sitestaffr-panel-tb-cell is-hours"><small>' + esc(t('Today')) + '</small><b>' + (isOpenLine(hoursText) ? '<i class="sitestaffr-panel-live" aria-hidden="true"></i>' : '') + keepTimes(hoursText) + '</b></div>' : '');
		return cells ? '<div class="sitestaffr-panel-tb' + (tel && hoursText ? '' : ' is-one') + '">' + cells + '</div>' : '';
	}

	/**
	 * Blueprint: grid paper, Talk and Type as two marked boxes, and a title block at the foot with the phone and
	 * today's hours (round 3, mockup 2). The hours live there on this screen, so the header keeps the AI line alone.
	 */
	function blueprintStartHtml(config, opts) {
		const canTalk = !!(opts && opts.canTalk);
		const canType = !opts || opts.canType !== false;
		const questions = canType ? (config.questions || []).slice(0, 3) : [];
		const box = (action, primary, iconName, title, note) => '<button type="button" class="sitestaffr-panel-mode' + (primary ? ' is-primary' : '') + '" data-panel-action="' + action + '">' +
			icon(iconName, 24) + '<span><b>' + title + '</b><small>' + note + '</small></span><i class="sitestaffr-panel-crop" aria-hidden="true"></i></button>';
		return '<div class="sitestaffr-panel-start">' +
			'<h3 class="sitestaffr-panel-greeting">' + word(config, 'greeting', 'Hi! How can we help?') + '</h3>' +
			'<i class="sitestaffr-panel-dim" aria-hidden="true"></i>' +
			'<div class="sitestaffr-panel-modes' + (canTalk && canType ? '' : ' is-one') + '">' +
				(canTalk ? box('talk', true, 'mic', word(config, 'talk', 'Talk'), word(config, 'talkNote', 'Speak, hands-free')) : '') +
				(canType ? box('type', !canTalk, 'chat', word(config, 'type', 'Type'), word(config, 'typeNote', 'Chat by text')) : '') +
			'</div>' +
			(questions.length ? '<p class="sitestaffr-panel-label">' + esc(t('Common questions')) + '</p><div class="sitestaffr-panel-questions">' + questions.map((q) => questionHtml(q, icon('arrow', 17))).join('') + '</div>' : '') +
			titleBlockHtml(config, hoursLine(config.hours, new Date())) +
			'</div>';
	}

	/** Sketch: hand-drawn outlines and a highlighter stroke on the greeting (round 3, mockup 3). The drawn arrow to Talk was removed (Mario: "It looks weird"). */
	function sketchStartHtml(config, opts) {
		const canTalk = !!(opts && opts.canTalk);
		const canType = !opts || opts.canType !== false;
		const questions = canType ? (config.questions || []).slice(0, 3) : [];
		const way = (action, primary, iconName, title, note) => '<button type="button" class="sitestaffr-panel-mode' + (primary ? ' is-primary' : '') + '" data-panel-action="' + action + '">' +
			icon(iconName, 26) + '<span><b>' + title + '</b><small>' + note + '</small></span></button>';
		return '<div class="sitestaffr-panel-start">' +
			'<div class="sitestaffr-panel-sketch-top"><h3 class="sitestaffr-panel-greeting"><span class="sitestaffr-panel-hl">' + word(config, 'greeting', 'Hi! How can we help?') + '</span></h3></div>' +
			'<div class="sitestaffr-panel-modes">' +
				(canTalk ? way('talk', true, 'mic', word(config, 'talk', 'Talk'), word(config, 'talkNote', 'Speak, hands-free')) : '') +
				(canType ? way('type', !canTalk, 'chat', word(config, 'type', 'Type'), word(config, 'typeNote', 'Chat by text')) : '') +
			'</div>' +
			(questions.length ? '<p class="sitestaffr-panel-label">' + esc(t('Good questions to start')) + '</p><div class="sitestaffr-panel-questions">' + questions.map((q) => questionHtml(q, icon('arrow', 18))).join('') + '</div>' : '') +
			callLineHtml(config, esc(t('Or call'))) +
			'</div>';
	}

	/* ---------- Talk Now: one big Talk button, typing as the way out ---------- */

	const TALK_TAGLINE = "Ask anything, out loud. I'll note your details so the team can follow up.";

	function talkNowStartHtml(config, opts) {
		const canType = !opts || opts.canType !== false;
		return '<div class="sitestaffr-panel-start sitestaffr-panel-start--voice">' +
			'<div class="sitestaffr-panel-hero-orb" aria-hidden="true"><span></span><span></span><span></span></div>' +
			'<h3 class="sitestaffr-panel-hero-title">' + (String(config.greeting || '').trim() ? esc(String(config.greeting).trim()) : esc(fmt(t('Talk to %s'), shortName(config)))) + '</h3>' +
			'<p class="sitestaffr-panel-tagline">' + esc(t(TALK_TAGLINE)) + '</p>' +
			'<button type="button" class="sitestaffr-panel-talk" data-panel-action="talk">' + icon('mic', 22, 2.2) + word(config, 'talk', 'Tap to talk') + '</button>' +
			(canType ? '<button type="button" class="sitestaffr-panel-type-link" data-panel-action="type">' + esc(t('Prefer to type?')) + '</button>' : '') +
			'<p class="sitestaffr-panel-fine-print">' + esc(t('AI assistant') + DOT + t('your browser will ask to use the microphone')) + '</p>' +
			'</div>';
	}

	/* ---------- Quick Sheet: three big actions, then the questions as chips ---------- */

	/**
	 * Ask a question (Type), Talk to us (only when the visitor can talk), and the main action (config.mainAction;
	 * only the call is offered, the same rule as Workshop's jump-to: a Guided Form runs as its own button's
	 * conversation, which this panel cannot start). The questions follow as chips; the composer sits at the foot
	 * of the panel (the stylesheet shows it on this screen).
	 */
	function quickSheetStartHtml(config, opts) {
		const canTalk = !!(opts && opts.canTalk);
		const canType = !opts || opts.canType !== false;
		const questions = canType ? (config.questions || []).slice(0, 3) : [];
		const main = config.mainAction;
		const phone = config.phone ? String(config.phone) : '';
		const tel = main && main.type === 'call' ? telHref(phone) : '';
		const body = (iconName, title, note) => '<span class="sitestaffr-panel-act-ic">' + icon(iconName, 20) + '</span><span><b>' + title + '</b><small>' + note + '</small></span>' + icon('chev', 18);
		const button = (cls, action, iconName, title, note) => '<button type="button" class="sitestaffr-panel-act ' + cls + '" data-panel-action="' + action + '">' + body(iconName, title, note) + '</button>';
		if (!canType && !canTalk && !tel) return '';
		return '<div class="sitestaffr-panel-start sitestaffr-panel-start--sheet">' +
			'<div class="sitestaffr-panel-acts">' +
				(canType ? button('is-type', 'type', 'chat', word(config, 'type', 'Ask a question'), word(config, 'typeNote', 'Type it, get an answer now')) : '') +
				(canTalk ? button('is-talk', 'talk', 'mic', word(config, 'talk', 'Talk to us'), word(config, 'talkNote', 'Voice, hands-free')) : '') +
				(tel ? '<a class="sitestaffr-panel-act is-main" href="' + esc(tel) + '">' + body('phone', esc(t('Call us')), esc(phone)) + '</a>' : '') +
			'</div>' +
			(questions.length ? '<div class="sitestaffr-panel-chips">' +
				questions.map((q) => '<button type="button" class="sitestaffr-panel-question sitestaffr-panel-chip" data-question="' + esc(q) + '"><span class="sitestaffr-panel-question-text">' + esc(q) + '</span></button>').join('') + '</div>' : '') +
			'</div>';
	}

	/* ---------- Half sheet (phones): the grab handle's drag rule ---------- */

	const SHEET_DRAG_PX = 40;

	/** Up opens the sheet to full, down brings it back to its sheet height. Nothing a drag does can close it. */
	function sheetAfterDrag(current, dy) {
		if (dy <= -SHEET_DRAG_PX) return 'full';
		if (dy >= SHEET_DRAG_PX) return 'half';
		return current === 'full' ? 'full' : 'half';
	}

	/** The open panel when it is a phone half sheet, else null: the widgets ask before they close or open anything. */
	function openPhoneSheet() {
		const el = typeof document !== 'undefined' && document.querySelector('.sitestaffr-panel.is-open');
		const panel = el && el._panel;
		return panel && panel._isPhoneSheet() ? panel : null;
	}

	/* ---------- contact card with Edit (text chat) ---------- */

	const CONTACT_LABELS = { name: 'Name', phone: 'Phone', email: 'Email', reason: 'Reason', address: 'Address' };
	const CONTACT_ORDER = ['name', 'phone', 'email', 'reason', 'address'];

	function contactLabel(key) {
		if (CONTACT_LABELS[key]) return t(CONTACT_LABELS[key]);
		const words = String(key).replace(/[_-]+/g, ' ').trim();
		return words.charAt(0).toUpperCase() + words.slice(1);
	}

	/** Known fields first in a fixed order, then any the button declared, in the order they arrived. */
	function contactFields(values) {
		const keys = Object.keys(values || {});
		const known = CONTACT_ORDER.filter((k) => keys.indexOf(k) !== -1);
		return known.concat(keys.filter((k) => CONTACT_ORDER.indexOf(k) === -1)).map((key) => ({ key, label: contactLabel(key) }));
	}

	/**
	 * "Your details": filled rows only, an Edit link, "Looks right" and the fine print. `state.editing`
	 * swaps the rows for inputs; `state.confirmed` collapses the card to its heading.
	 */
	function contactCardHtml(fields, values, businessName, state) {
		const st = state || {};
		const filled = (fields || []).filter((f) => values && values[f.key]);
		const rows = st.editing
			? filled.map((f) => '<div><dt><label for="ssp-edit-' + esc(f.key) + '">' + esc(f.label) + '</label></dt><dd><input type="text" id="ssp-edit-' + esc(f.key) + '" class="sitestaffr-panel-edit-input" data-contact-key="' + esc(f.key) + '" value="' + esc(values[f.key]) + '" maxlength="200"></dd></div>').join('')
			: filled.map((f) => detailRowHtml(f.label, values[f.key], st.changed && st.changed[f.key])).join('');
		// Concierge writes the card like a form: a line asking the visitor to check it, and the way to
		// change it as a plain link under the button. Every other look keeps Edit in the heading.
		const underButton = st.look === 'concierge' && !st.readOnly;
		const workOrder = st.look === 'workshop' && !st.editing && !st.readOnly;
		const editButton = (label, withIcon) => '<button type="button" class="sitestaffr-panel-edit" data-panel-action="edit-contact">' + (withIcon ? icon('edit', 14) : '') + label + '</button>';
		// A card left by a voice call has no inline Edit (decision 7): "Tell us" opens Type instead.
		const tellUs = st.readOnly ? '<button type="button" class="sitestaffr-panel-tell" data-panel-action="tell-us">' + esc(t('Something wrong? Tell us')) + '</button>' : '';
		const action = st.editing
			? '<div class="sitestaffr-panel-card-actions"><button type="button" class="sitestaffr-panel-go" data-panel-action="save-contact">' + esc(t('Save')) + '</button><button type="button" class="sitestaffr-panel-plain" data-panel-action="cancel-contact">' + esc(t('Cancel')) + '</button></div>'
			: (workOrder
				? '<div class="sitestaffr-panel-card-actions">' + editButton(esc(t('Edit')), true) + '<button type="button" class="sitestaffr-panel-go" data-panel-action="confirm-contact">' + esc(t('Looks right')) + icon('arrow', 20, 2.4) + '</button></div>'
				: '<button type="button" class="sitestaffr-panel-go" data-panel-action="confirm-contact">' + esc(t('Looks right')) + '</button>' + (underButton ? editButton(esc(t('Change something')), false) : '') + tellUs);
		return '<div class="sitestaffr-panel-card' + (st.confirmed ? ' is-confirmed' : '') + (st.editing ? ' is-editing' : '') + '" role="group" aria-label="' + esc(t('Your details')) + '">' +
			'<div class="sitestaffr-panel-card-head">' + icon('check', 16, 2.6) + '<b>' + esc(t(st.confirmed ? 'Thanks, these are confirmed' : 'Your details')) + '</b>' +
				(workOrder ? (st.confirmed ? '' : '<span class="sitestaffr-panel-card-step">' + esc(t('Check & send')) + '</span>') : (st.editing || st.readOnly || underButton ? '' : editButton(esc(t('Edit')), true))) + '</div>' +
			(underButton ? '<p class="sitestaffr-panel-card-sub">' + esc(t('Please check these details before I send them.')) + '</p>' : '') +
			'<dl>' + rows + '</dl>' + action +
			'<p class="sitestaffr-panel-fine">' + icon('lock', 12) + esc(endSentence(fmt(t('Goes only to %s'), businessName || t('this business')))) + '</p></div>';
	}

	/* ---------- When the assistant cannot answer (#534) ---------- */

	/** The buttons under an error line. Voice is only ever among them when the server said it works for this site. */
	const NOTICE_ACTIONS = {
		retry: { label: 'Send again' },
		leave: { label: 'Leave your details' },
		talk: { label: 'Talk instead' },
		newchat: { label: 'Start a new one' }
	};

	function noticeHtml(text, actions) {
		const list = (actions || []).filter((a) => NOTICE_ACTIONS[a]);
		return '<div class="sitestaffr-chat-notice sitestaffr-panel-notice" role="status"><p>' + esc(t(text)) + '</p>' +
			(list.length ? '<div class="sitestaffr-panel-notice-actions">' + list.map((a, i) =>
				'<button type="button" class="sitestaffr-panel-notice-btn' + (i === 0 ? ' is-primary' : '') + '" data-panel-action="notice-' + a + '">' +
				(a === 'talk' ? icon('mic', 15, 2.2) : '') + esc(t(NOTICE_ACTIONS[a].label)) + '</button>').join('') + '</div>' : '') +
			'</div>';
	}

	/** "The team is in until 6 PM today ..." from the same hours line the header shows. */
	function teamInLine(hoursText) {
		const open = unfmt(t('Open now') + DOT + t('until %s'), hoursText, ['.+']);
		if (open) return fmt(t('The team is in until %s today and will get back to you.'), open[0]);
		const days = [t('tomorrow')].concat(DAYS.map((d) => t('day:' + d, d.charAt(0).toUpperCase() + d.slice(1))));
		const when = days.map((d) => d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
		// "a la 1" reads back as "las 1"; the line is only parsed here.
		const next = unfmt(t('Closed') + DOT + t('opens %1$s %2$s'), WORDS ? String(hoursText || '').replace(/\bla 1(?=[: ])/g, 'las 1') : hoursText, [when, '.+']);
		if (next) return oneOClock(fmt(t('The team opens %1$s at %2$s and will get back to you then.'), next[0], next[1]));
		return t('The team will get back to you.');
	}

	/** The business phone under the form, in the look's own wording; nothing when there is no dialable number. */
	function helpPhoneHtml(config) {
		const phone = config.phone ? String(config.phone) : '';
		const tel = telHref(phone);
		if (!tel) return '';
		return config.look === 'concierge'
			? '<a class="sitestaffr-panel-call-line" href="' + esc(tel) + '">' + esc(t('Or call the office at')) + ' <b>' + esc(phone) + '</b></a>'
			: '<a class="sitestaffr-panel-call-line" href="' + esc(tel) + '">' + icon('phone', 16) + esc(t('Prefer to call?')) + ' <b>' + esc(phone) + '</b></a>';
	}

	/**
	 * The leave-your-details form, drawn in the look's own details card. `mode` 'conversation' replaces the
	 * conversation after the visitor asked something (the question rides in the Message field); 'start' is the
	 * first screen when the assistant cannot answer on open. Phone or email is enough: the submit handler asks.
	 * opts: { mode, question, values (what the conversation already learned: name, phone, email), canGoBack, now }
	 */
	function helpFormHtml(config, opts) {
		const o = opts || {};
		const look = config.look;
		const workshop = look === 'workshop';
		const start = o.mode === 'start';
		const biz = config.name ? String(config.name) : t('this business');
		const title = start ? (look === 'concierge' ? greetingFor(o.now || new Date()) : t(workshop ? 'Leave us a message' : 'Hi! Leave us a message.')) : t('Leave your details');
		const intro = workshop
			? t('Our assistant can’t answer right now. Leave a phone or email and the team will get back to you.')
			: (start ? t('Our assistant can’t answer right now. The team will get back to you.') : fmt(t('Our assistant can’t answer right now. The team at %s will get back to you.'), biz));
		const known = o.values || {};
		const field = (name, label, type, auto) => '<label class="sitestaffr-panel-help-field"><span>' + esc(t(label)) + '</span><input type="' + type + '" name="' + name + '" autocomplete="' + auto + '" maxlength="200" value="' + esc(known[name] || '') + '"></label>';
		const head = start
			? '<h3 class="sitestaffr-panel-greeting">' + esc(title) + '</h3>'
			: '<div class="sitestaffr-panel-card-head">' + icon('check', 16, 2.6) + '<b>' + esc(title) + '</b></div>';
		return '<div class="sitestaffr-panel-help' + (start ? ' is-start' : '') + '" data-help-mode="' + (start ? 'start' : 'conversation') + '" role="group" aria-label="' + esc(title) + '" tabindex="-1">' +
			'<div class="' + (start ? 'sitestaffr-panel-help-body' : 'sitestaffr-panel-card sitestaffr-panel-help-body') + '">' + head +
			'<p class="sitestaffr-panel-help-intro">' + esc(intro) + '</p>' +
			'<form class="sitestaffr-panel-help-form" novalidate>' +
				field('name', 'Name', 'text', 'name') + field('phone', 'Phone', 'tel', 'tel') + field('email', 'Email', 'email', 'email') +
				'<label class="sitestaffr-panel-help-field"><span>' + esc(t('Message')) + '</span><textarea name="message" rows="3" maxlength="2000">' + esc(o.question || '') + '</textarea></label>' +
				(workshop ? '' : '<p class="sitestaffr-panel-help-hint">' + esc(t('Phone or email is enough, whichever you prefer.')) + '</p>') +
				'<p class="sitestaffr-panel-help-error" role="alert" hidden></p>' +
				'<button type="submit" class="sitestaffr-panel-go">' + esc(t('Send to the team')) + '</button>' +
			'</form>' +
			(o.canGoBack ? '<button type="button" class="sitestaffr-panel-plain sitestaffr-panel-help-back" data-panel-action="help-back">' + esc(t('Back to the conversation')) + '</button>' : '') +
			'<p class="sitestaffr-panel-fine">' + icon('lock', 12) + esc(fmt(t('Goes only to %s'), biz)) + '.</p></div>' +
			helpPhoneHtml(config) + '</div>';
	}

	/** What went, to whom, and when the team is in. `opts.hoursText` is the live hours line (empty when the owner set none). */
	function helpSentHtml(config, values, opts) {
		const o = opts || {};
		const start = o.mode === 'start';
		const biz = config.name ? String(config.name) : t('this business');
		const rows = [[t('Name'), values.name], [t('Phone'), values.phone], [t('Email'), values.email], [t('Message'), values.message]]
			.filter((r) => r[1]).map((r) => rowHtml(r[0], esc(r[1]))).join('');
		const first = String(values.name || '').trim().split(/\s+/)[0];
		return '<div class="sitestaffr-panel-help is-sent' + (start ? ' is-start' : '') + '" data-help-mode="' + (start ? 'start' : 'conversation') + '" role="status" tabindex="-1">' +
			(start && first ? '<h3 class="sitestaffr-panel-greeting">' + esc(fmt(t('Thanks, %s.'), first)) + '</h3>' : '') +
			'<div class="sitestaffr-panel-card sitestaffr-panel-help-body">' +
			'<div class="sitestaffr-panel-card-head">' + icon('check', 16, 2.6) + '<b>' + esc(fmt(t('Sent to %s'), biz)) + '</b></div>' +
			'<dl>' + rows + '</dl>' +
			'<p class="sitestaffr-panel-help-when">' + esc(teamInLine(o.hoursText)) + '</p>' +
			'<p class="sitestaffr-panel-fine">' + icon('lock', 12) + esc(fmt(t('Goes only to %s'), biz)) + '.</p></div>' +
			helpPhoneHtml(config) + '</div>';
	}

	/* ---------- Phase 3: live notepad and call screen ---------- */

	/** One row for the contact card and the live notepad, so the notepad can become the card. */
	function rowHtml(label, valueHtml, cls) {
		return '<div' + (cls ? ' class="' + cls + '"' : '') + '><dt>' + esc(label) + '</dt><dd>' + valueHtml + '</dd></div>';
	}

	/** One saved detail: a check, the value, and a "Changed" tag on a row the visitor just corrected. */
	function detailRowHtml(label, value, changed) {
		return rowHtml(label,
			'<span class="sitestaffr-panel-note-ck">' + icon('check', 12, 3) + '</span><span class="sitestaffr-panel-val">' + esc(value) + '</span>' +
			(changed ? '<span class="sitestaffr-panel-tag">' + esc(t('Changed')) + '</span>' : ''),
			changed ? 'is-new' : '');
	}

	/**
	 * The call's version of the details card: the same rows, no buttons (a call has hands busy), and a line
	 * saying how to answer by voice. It exists only from the read-back on; before that nothing is listed.
	 */
	function callDetailsHtml(fields, values, changed) {
		const rows = (fields || []).filter((f) => values && values[f.key]).map((f) => detailRowHtml(f.label, values[f.key], changed && changed[f.key])).join('');
		return '<div class="sitestaffr-panel-note-head"><b>' + esc(t('Your details')) + '</b></div><dl>' + rows + '</dl>' +
			'<p class="sitestaffr-panel-hint">' + esc(t('Say “that’s right” or tell me what to change.')) + '</p>';
	}

	/** The quiet line in the transcript where a detail was saved, changed or dropped. */
	function receiptHtml(kind, label, value) {
		const what = esc(String(label).toLowerCase());
		const text = kind === 'removed' ? fmt(esc(t('Removed your %s')), what)
			: fmt(esc(t(kind === 'changed' ? 'Changed your %s' : 'Noted your %s')), what) + ', <b>' + esc(value) + '</b>';
		return '<p class="sitestaffr-panel-receipt' + (kind === 'removed' ? ' is-removed' : '') + '"><span class="sitestaffr-panel-note-ck">' +
			icon(kind === 'removed' ? 'x' : 'check', 12, 3) + '</span><span>' + text + '</span></p>';
	}

	/** The divider where a conversation changes mode: "Talked · 1:36", "Switched to typing", "Voice ended". */
	function dividerHtml(kind, seconds) {
		const label = kind === 'talked' ? t('Talked') + (typeof seconds === 'number' ? DOT + callTimeText(seconds) : '')
			: t(kind === 'typing' ? 'Switched to typing' : 'Voice ended');
		return '<div class="sitestaffr-panel-divider" role="separator">' + icon(kind === 'talked' ? 'mic' : (kind === 'typing' ? 'kbd' : 'micOff'), 13) + '<span>' + esc(label) + '</span></div>';
	}

	/**
	 * Did the assistant just ask the visitor to check what it saved? The call's own signal is onReadBack; this
	 * reads the same moment from the words, for a text chat and for a call whose button declared no fields.
	 */
	function isReadBack(text) {
		return /\b(?:look|looks|looked|seem|seems|sound|sounds)\s+(?:all\s+)?(?:right|correct|good|accurate)\b|\b(?:is|are)\s+(?:that|this|it|everything|all of (?:that|this|it)|all)\s+(?:right|correct|accurate)\b|\b(?:right|correct)\s*\?|\banything\s+(?:you.d|you would|to|you want to)\s+(?:like to\s+)?(?:change|fix|correct)\b/i.test(String(text || ''));
	}

	/** The words under the orb. 'connecting' carries the AI disclosure (see the widgets' conversationStatusText). */
	function callStatusText(state, query) {
		switch (state) {
			case 'connecting': return t('Connecting to AI Assistant...');
			case 'listening': return t('Listening…');
			case 'thinking': return t('Processing…');
			case 'searching': return query ? fmt(t('Searching %s…'), query) : t('Searching…');
			case 'speaking': return t('Speaking…');
			case 'error': return t('Connection problem');
			default: return '';
		}
	}

	function callTimeText(seconds) {
		const s = Math.max(0, Math.floor(seconds || 0));
		return Math.floor(s / 60) + ':' + pad(s % 60);
	}

	/** The speaking state: five bars that rise and fall (never a speaker icon: Mario prefers the waves). */
	const WAVE_HTML = '<span class="sitestaffr-panel-wave"><b></b><b></b><b></b><b></b><b></b></span>';

	/** The call screen: orb, status, captions, the details card (hidden until the read-back), Mute / Type / End. */
	function callHtml(config, opts) {
		const canType = !opts || opts.canType !== false;
		const workshop = config && config.look === 'workshop';
		// Workshop reads at arm's length: a big timer and level bars where the others have the orb and the header count.
		const bars = Array(28).fill('<i></i>').join('');
		return '<div class="sitestaffr-panel-call" data-call-state="connecting" tabindex="-1">' +
			(workshop ? '<div class="sitestaffr-panel-timer" aria-hidden="true">0:00</div><div class="sitestaffr-panel-bars" aria-hidden="true">' + bars + '</div>' : '') +
			'<div class="sitestaffr-panel-orb" aria-hidden="true"><span></span><span></span><span></span><div class="sitestaffr-panel-orb-core">' + icon('mic', 34) + '</div></div>' +
			'<div class="sitestaffr-panel-call-status" role="status" aria-live="polite">' + esc(callStatusText('connecting')) + '</div>' +
				'<div class="sitestaffr-panel-wave is-status" aria-hidden="true"><b></b><b></b><b></b><b></b><b></b></div>' +
				'<p class="sitestaffr-panel-continue" hidden>' + icon('chat', 13) + esc(t('Picking up from your chat')) + '</p>' +
			'<div class="sitestaffr-panel-captions" hidden>' +
				'<p class="sitestaffr-panel-caption is-ai" hidden><b>' + esc(config && config.look === 'concierge' ? shortName(config) : String((config && config.name) || t('Assistant'))) + '</b><span class="sitestaffr-panel-caption-text"></span></p>' +
				'<p class="sitestaffr-panel-caption is-visitor" hidden><b>' + esc(t('You')) + '</b><span class="sitestaffr-panel-caption-text"></span></p>' +
			'</div>' +
			'<div class="sitestaffr-panel-notepad" aria-live="polite" hidden></div>' +
			'<div class="sitestaffr-panel-call-controls">' +
				'<button type="button" class="sitestaffr-panel-call-btn is-mute" data-panel-action="call-mute" aria-pressed="false">' + icon('micOff', 22) + '<small>' + esc(t('Mute')) + '</small></button>' +
				(canType ? '<button type="button" class="sitestaffr-panel-call-btn" data-panel-action="call-type">' + icon('kbd', 22) + '<small>' + esc(t('Type')) + '</small></button>' : '') +
				'<button type="button" class="sitestaffr-panel-call-btn is-end" data-panel-action="call-end">' + icon('phone', 22) + '<small>' + esc(t('End')) + '</small></button>' +
			'</div></div>';
	}

	/* ---------- the panel ---------- */

	/**
	 * One panel for the floating widget and in-page buttons. It builds the element and owns what is
	 * on it (screens, header hours, contact card); the widget owns the conversation. The inner class
	 * names are the contract the widgets already drive (appendMessage, typing indicator, contact
	 * form, link clicks, the phone keyboard sync).
	 *
	 * opts: { root, config, canTalk, canType, soundsEnabled, position, onTalk, onType, onAsk(q),
	 *         onClose, onMute(button), onSend, onInput, onContactEdit(key, value),
	 *         notepadFields (the button's declared contact fields), and the call screen's
	 *         onCallMute(muted), onCallType(), onCallEnd(), onTellUs() }
	 */
	class SiteStaffrPanelView {
		constructor(opts) {
			this.opts = opts;
			this.config = opts.config || {};
			if (this.config.words) useWords(this.config.words);
			this.canTalk = !!opts.canTalk;
			this.canType = opts.canType !== false;
			this.screen = 'start';
			this.contact = {};
			this.contactState = { editing: false, confirmed: false };
			// Details show only from the read-back on; what changed since is tagged until the visitor confirms.
			this.detailsShown = false;
			this.changed = {};
			this.agentTurns = 0;
			this.isOpen = false;

			const mark = (opts.root && opts.root.getAttribute('data-ssp-mark')) || 'initial';
			const el = document.createElement('div');
			el.className = 'sitestaffr-chat-panel sitestaffr-panel' + (opts.position === null ? '' : ' position-' + (opts.position || 'bottom-right'));
			el.setAttribute('data-ssp-screen', 'start');
			// The page's language (#766): screen readers read it in that language, and Arabic and Persian run right to left.
			if (/^[a-z]{2,3}$/.test(String(this.config.lang || ''))) el.setAttribute('lang', this.config.lang);
			if (this.config.dir === 'rtl') el.setAttribute('dir', 'rtl');
			this.sheet = 'half';
			el.setAttribute('data-ssp-sheet', 'half');
			// The stylesheet shows the composer on the Quick Sheet first screen only for a visitor who can type,
			// and hides every Talk and mic action once talking is no longer possible (setCanTalk).
			el.setAttribute('data-ssp-can-type', this.canType ? 'true' : 'false');
			el.setAttribute('data-ssp-can-talk', this.canTalk ? 'true' : 'false');
			// The grab handle is on every panel and shows only on a phone half sheet (stylesheet).
			el.innerHTML = '<button type="button" class="sitestaffr-panel-grab" aria-label="' + esc(t('Expand the chat')) + '"><i aria-hidden="true"></i></button>' +
				headerHtml(this.config, mark, this.config.look === 'workshop' ? hoursLine(this.config.hours, new Date()) : '', !!opts.soundsEnabled, this.canTalk) +
				startHtml(this.config, { canTalk: this.canTalk, canType: this.canType }) +
				'<div class="sitestaffr-chat-messages"><div class="sitestaffr-chat-typing"><span class="sitestaffr-chat-typing-dot"></span><span class="sitestaffr-chat-typing-dot"></span><span class="sitestaffr-chat-typing-dot"></span></div></div>' +
				'<div class="sitestaffr-chat-char-count"></div>' +
				(healthNote() ? '<p class="sitestaffr-chat-health-note">' + esc(healthNote()) + '</p>' : '') +
				'<div class="sitestaffr-chat-input-area">' +
					'<div class="sitestaffr-chat-input-wrapper"><textarea class="sitestaffr-chat-textarea" placeholder="' + esc(t('Type a message...')) + '" rows="1" maxlength="2000" aria-label="' + esc(t('Your message')) + '"></textarea></div>' +
					(this.canTalk ? '<button type="button" class="sitestaffr-panel-mic" data-panel-action="mic" aria-label="' + esc(t('Talk instead')) + '">' + icon('mic', 19) + (this.config.look === 'concierge' ? esc(t('Speak')) : '') + '</button>' : '') +
					'<button type="button" class="sitestaffr-chat-send-btn" aria-label="' + esc(t('Send message')) + '">' + icon(this.config.look === 'concierge' ? 'arrow' : 'send', 18) + '</button>' +
				'</div>' + callHtml(this.config, { canType: this.canType });
			this.el = el;
			el._panel = this;
			// Beside the replies (#609): the initial the stylesheet draws, as a CSS string (quotes and backslashes cannot reach it).
			el.style.setProperty('--ssp-initial', '"' + (Array.from(String(this.config.name || t('Chat')))[0] || '').toUpperCase().replace(/["\\\n\r]/g, '') + '"');
			if (opts.root && root.SiteStaffrChatStyle) root.SiteStaffrChatStyle.apply(opts.root, el);
			if (opts.root && opts.root.classList.contains('sitestaffr-tooltip--bottom')) el.classList.add('sitestaffr-tooltip--bottom');
			this._bind();
			this._keepCardLast();
			// The window, the phone keyboard and late web fonts all change how much room the first screen has.
			let fitting = 0;
			const refit = () => { if (!fitting) fitting = requestAnimationFrame(() => { fitting = 0; if (this.el.isConnected) this._fitStart(); }); };
			window.addEventListener('resize', refit);
			// The half sheet grows and shrinks over 0.22s: measure again once it has settled.
			el.addEventListener('transitionend', (e) => { if (e.target === el && e.propertyName === 'height') refit(); });
			if (window.visualViewport) window.visualViewport.addEventListener('resize', refit);
			if (document.fonts && document.fonts.ready) document.fonts.ready.then(refit);
			document.body.appendChild(el);
		}

		_bind() {
			const o = this.opts;
			const el = this.el;
			const textarea = el.querySelector('.sitestaffr-chat-textarea');
			el.addEventListener('click', (e) => {
				const t = e.target.closest && e.target.closest('[data-panel-action], .sitestaffr-panel-question, .sitestaffr-chat-close-btn, .sitestaffr-chat-mute-btn, .sitestaffr-chat-send-btn');
				if (!t || !el.contains(t)) return;
				if (t.classList.contains('sitestaffr-panel-question')) { if (o.onAsk) o.onAsk(t.getAttribute('data-question') || ''); return; }
				if (t.classList.contains('sitestaffr-chat-close-btn')) { if (o.onClose) o.onClose(); return; }
				if (t.classList.contains('sitestaffr-chat-mute-btn')) { if (o.onMute) o.onMute(t); return; }
				if (t.classList.contains('sitestaffr-chat-send-btn')) { if (o.onSend) o.onSend(); return; }
				const action = t.getAttribute('data-panel-action');
				if (action === 'talk' || action === 'mic') { if (o.onTalk) o.onTalk(); }
				else if (action === 'type') { if (o.onType) o.onType(); }
				else if (action === 'ask') { if (o.onAsk) o.onAsk(t.getAttribute('data-question') || ''); }
				else if (action === 'help-back') this._leaveHelp();
				else if (action && action.indexOf('notice-') === 0) this._noticeAction(action.slice(7), t);
				else if (action === 'edit-contact') this._editContact(true);
				else if (action === 'cancel-contact') this._editContact(false);
				else if (action === 'save-contact') this._saveContact();
				else if (action === 'confirm-contact') { this.contactState = Object.assign({}, this.contactState, { editing: false, confirmed: true }); this.changed = {}; this._renderCard(); }
				else this._callAction(action);
			});
			textarea.addEventListener('keydown', (e) => {
				if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (o.onSend) o.onSend(); }
			});
			el.addEventListener('submit', (e) => {
				const form = e.target && e.target.closest && e.target.closest('.sitestaffr-panel-help-form');
				if (!form) return;
				e.preventDefault();
				this._submitHelp(form);
			});
			// A half sheet cannot hold a keyboard and a conversation: any field inside the panel (the message
			// field, the contact card's Edit fields, the inactive-plan contact form) takes the whole screen.
			el.addEventListener('focusin', (e) => {
				if (e.target && e.target.matches && e.target.matches('input, textarea, select') && this._isPhoneSheet()) this._setSheet('full');
			});
			this._bindGrab();
			textarea.addEventListener('input', () => {
				textarea.style.height = 'auto';
				textarea.style.height = Math.min(textarea.scrollHeight, 100) + 'px';
				if (o.onInput) o.onInput();
			});
			el.addEventListener('keydown', (e) => {
				const inEdit = e.target.classList && e.target.classList.contains('sitestaffr-panel-edit-input');
				if (inEdit && e.key === 'Enter') { e.preventDefault(); this._saveContact(); }
				if (inEdit && e.key === 'Escape') { e.stopPropagation(); this._editContact(false); }
			});
		}

		/** The sheet is a phone layout: the attribute says the owner chose it, the media query says this is a phone. */
		_isPhoneSheet() {
			return this.el.getAttribute('data-ssp-phone') === 'sheet' && !!root.matchMedia && root.matchMedia('(max-width: 480px)').matches;
		}

		_setSheet(state) {
			this.sheet = state === 'full' ? 'full' : 'half';
			this.el.setAttribute('data-ssp-sheet', this.sheet);
			const grab = this.el.querySelector('.sitestaffr-panel-grab');
			if (grab) grab.setAttribute('aria-label', t(this.sheet === 'full' ? 'Shrink the chat' : 'Expand the chat'));
			this._fitStart();
		}

		/** A tap on the button that owns the sheet: full screen, never closed. False when this is not a phone sheet. */
		expandSheet() {
			if (!this._isPhoneSheet()) return false;
			this._setSheet('full');
			return true;
		}

		/**
		 * Voice minutes ran out or the daily cap was reached: nothing in the panel offers Talk any more. The
		 * first screen is rebuilt without it (a voice-first screen becomes the look's Talk and type screen),
		 * and the mic and "Talk instead" go. Only turning it off is supported: a reload brings it back.
		 */
		setCanTalk(can) {
			this.canTalk = !!can;
			this.el.setAttribute('data-ssp-can-talk', this.canTalk ? 'true' : 'false');
			if (this.canTalk) return;
			this.el.querySelectorAll('.sitestaffr-panel-mic, .sitestaffr-panel-back').forEach((n) => n.remove());
			const start = this.el.querySelector('.sitestaffr-panel-start');
			if (start) start.outerHTML = startHtml(this.config, { canTalk: false, canType: this.canType });
		}

		/**
		 * The handle at the top of the half sheet: drag up for full, drag down to come back, a plain tap (or
		 * Enter) toggles. The listeners sit on the handle itself, never on the document, and nothing here
		 * closes the panel: only the close button does (#358).
		 */
		_bindGrab() {
			const grab = this.el.querySelector('.sitestaffr-panel-grab');
			let startY = null;
			let dragged = false;
			grab.addEventListener('pointerdown', (e) => {
				startY = e.clientY;
				dragged = false;
				if (grab.setPointerCapture) { try { grab.setPointerCapture(e.pointerId); } catch (err) { /* a synthetic pointer */ } }
			});
			grab.addEventListener('pointermove', (e) => {
				if (startY !== null && Math.abs(e.clientY - startY) > 8) dragged = true;
			});
			grab.addEventListener('pointerup', (e) => {
				if (startY === null) return;
				const dy = e.clientY - startY;
				startY = null;
				this._setSheet(dragged ? sheetAfterDrag(this.sheet, dy) : (this.sheet === 'full' ? 'half' : 'full'));
				// Back to the sheet height: put the keyboard away too, or the field would still be focused behind it.
				const active = document.activeElement;
				if (this.sheet === 'half' && active && this.el.contains(active) && active.matches('input, textarea, select')) active.blur();
			});
			grab.addEventListener('pointercancel', () => { startY = null; });
			// Keyboard: a click with no pointer behind it (detail 0) is Enter or Space.
			grab.addEventListener('click', (e) => { if (e.detail === 0) this._setSheet(this.sheet === 'full' ? 'half' : 'full'); });
		}

		/** Later messages go under the card in the DOM, so it moves back to the end: they push it up, not away. */
		_keepCardLast() {
			if (typeof MutationObserver === 'undefined') return;
			const list = this.el.querySelector('.sitestaffr-chat-messages');
			new MutationObserver(() => {
				const card = list.querySelector('.sitestaffr-panel-contact');
				const typing = list.querySelector('.sitestaffr-chat-typing');
				if (!card || !typing || card.nextElementSibling === typing) return;
				// Moving a node blurs whatever inside it has focus: put the field and its caret back.
				const active = document.activeElement;
				const field = active && card.contains(active) ? active : null;
				const caret = field && typeof field.selectionStart === 'number' ? [field.selectionStart, field.selectionEnd, field.selectionDirection] : null;
				list.insertBefore(card, typing);
				if (field && document.activeElement !== field) {
					field.focus({ preventScroll: true });
					if (caret) field.setSelectionRange(caret[0], caret[1], caret[2] || 'none');
				}
			}).observe(list, { childList: true });
		}

		/**
		 * One more line in the conversation, with the buttons that are a way forward (#534). `actions` are
		 * 'retry' | 'leave' | 'talk' | 'newchat'; a tap reports through opts.onNotice(action).
		 */
		addNotice(text, actions) {
			const list = this.el.querySelector('.sitestaffr-chat-messages');
			const holder = document.createElement('template');
			holder.innerHTML = noticeHtml(text, actions);
			list.insertBefore(holder.content.firstElementChild, list.querySelector('.sitestaffr-chat-typing'));
			list.scrollTop = list.scrollHeight;
		}

		_noticeAction(kind, btn) {
			// Send again is spent by the send itself (a new line follows if it fails again); the others stay, so a visitor
			// who steps back from the form can still choose.
			if (kind === 'retry') {
				const notice = btn.closest('.sitestaffr-panel-notice');
				if (notice) notice.remove();
			}
			if (this.opts.onNotice) this.opts.onNotice(kind);
		}

		/**
		 * The leave-your-details form (#534). mode 'conversation' replaces the conversation after a question,
		 * 'start' is the first screen when the assistant cannot answer on open. After a send the form stays as
		 * its "Sent" card for the rest of the page.
		 * o: { mode, question, canGoBack, onSubmit(values) }
		 */
		showHelp(o) {
			const prior = this.el.querySelector('.sitestaffr-panel-help');
			if (prior && prior.classList.contains('is-sent')) {
				this.show('help');
				return;
			}
			this._help = Object.assign({ mode: 'conversation' }, o);
			if (prior) prior.remove();
			this.el.querySelector('.sitestaffr-chat-messages').insertAdjacentHTML('beforebegin', helpFormHtml(this.config, this._help));
			this.show('help');
			if (this._help.mode !== 'start') this.el.querySelector('.sitestaffr-panel-help').focus({ preventScroll: true });
		}

		/** Back from the form to the conversation it replaced (only offered when the chat can go on). */
		_leaveHelp() {
			const help = this.el.querySelector('.sitestaffr-panel-help');
			if (help && !help.classList.contains('is-sent')) help.remove();
			this.show('text');
		}

		_submitHelp(form) {
			const value = (name) => String(form.elements[name] ? form.elements[name].value : '').trim();
			const values = { name: value('name'), phone: value('phone'), email: value('email'), message: value('message') };
			const fail = (name, text) => {
				const err = form.querySelector('.sitestaffr-panel-help-error');
				err.textContent = text;
				err.hidden = false;
				if (form.elements[name]) form.elements[name].focus();
			};
			if (!values.phone && !values.email) return fail('phone', t('Please add a phone number or an email so the team can reach you.'));
			if (values.email && !/^\S+@\S+\.\S+$/.test(values.email)) return fail('email', t('That email doesn’t look right.'));
			if (!values.message) return fail('message', t('Please tell the team what you need.'));
			const button = form.querySelector('button[type="submit"]');
			button.disabled = true;
			button.textContent = t('Sending...');
			const help = this._help || {};
			if (help.onSubmit) help.onSubmit(values);
			const holder = document.createElement('template');
			holder.innerHTML = helpSentHtml(this.config, values, { mode: help.mode, hoursText: hoursLine(this.config.hours, new Date()) });
			const sent = holder.content.firstElementChild;
			form.closest('.sitestaffr-panel-help').replaceWith(sent);
			sent.focus({ preventScroll: true });
		}

		/** 'start' | 'text' | 'call' | 'help'. */
		show(screen) {
			const was = this.screen;
			this.screen = screen;
			this.el.setAttribute('data-ssp-screen', screen);
			if (was === 'call' && screen !== 'call') this._leaveCall();
			if (screen === 'call') this._renderCallSubtitle();
			// Blueprint's hours move from the first screen's title block to the header and back.
			else if (this.config.look === 'blueprint' && was !== screen) this.refreshHours();
			if (screen === 'start') this._fitStart();
		}

		/** Concierge labels each turn with who is speaking; every other look keeps the bare bubble. */
		labelsTurns() {
			return this.config.look === 'concierge';
		}

		/**
		 * Adds one message before the typing indicator and returns its bubble (inside its labelled
		 * turn for Concierge). The widgets call it instead of building the bubble themselves when
		 * labelsTurns() is true; `extraClass` is for the streaming bubble.
		 */
		addMessage(role, body, extraClass) {
			const list = this.el.querySelector('.sitestaffr-chat-messages');
			const holder = document.createElement('template');
			holder.innerHTML = messageHtml(role, body, { look: this.config.look, shortName: shortName(this.config) });
			const node = holder.content.firstElementChild;
			list.insertBefore(node, list.querySelector('.sitestaffr-chat-typing'));
			const bubble = node.classList.contains('sitestaffr-chat-message') ? node : node.querySelector('.sitestaffr-chat-message');
			if (extraClass) bubble.classList.add(extraClass);
			return bubble;
		}

		/** Concierge greets by the visitor's clock, recomputed when the panel opens. */
		refreshGreeting() {
			// The owner's own greeting (#609) is never replaced by the clock's.
			const h = this.config.look === 'concierge' && this.el.querySelector('.sitestaffr-panel-greeting:not([data-panel-own])');
			if (h) h.textContent = greetingFor(new Date());
		}

		/** Recomputed every time the panel opens: a page cached at 5 PM must still say Closed at 7. */
		refreshHours() {
			if (this.screen === 'call') { this._renderCallSubtitle(); return; }
			const sub = this.el.querySelector('.sitestaffr-chat-header-subtitle');
			const text = hoursLine(this.config.hours, new Date());
			if (this.config.look === 'workshop') {
				// The strip under the header carries the hours; it appears, changes or goes with them.
				if (sub) sub.innerHTML = subtitleHtml('');
				const strip = this.el.querySelector('.sitestaffr-panel-status');
				if (strip) strip.remove();
				const header = this.el.querySelector('.sitestaffr-panel-header');
				if (header && text) header.insertAdjacentHTML('afterend', statusHtml(text));
				return;
			}
			if (this.config.look === 'blueprint') {
				// The title block carries the hours on the first screen; the header takes them from the conversation on.
				// Only Blueprint's own first screen has one (Voice first and Main actions do not), and with hours set it
				// always has text, so a refresh only ever rewrites the block the screen was built with.
				const block = this.el.querySelector('.sitestaffr-panel-tb');
				if (block) block.outerHTML = titleBlockHtml(this.config.phoneLine === false ? Object.assign({}, this.config, { phone: '' }) : this.config, text);
				if (sub) sub.innerHTML = subtitleHtml(this.screen === 'start' ? '' : text);
				return;
			}
			if (sub) sub.innerHTML = subtitleHtml(text);
		}

		open() {
			this._setSheet('half');
			this.refreshHours();
			this.refreshGreeting();
			void this.el.offsetWidth;
			this.el.classList.add('is-open');
			this.isOpen = true;
			this._fitStart();
		}

		/**
		 * The first screen never scrolls (#582): when it does not fit, spacing tightens first, then the
		 * last questions drop out one at a time (a question that is gone beats one you have to scroll to).
		 */
		_fitStart() {
			const st = this.el.querySelector('.sitestaffr-panel-start');
			if (!st || !this.isOpen || this.screen !== 'start' || !st.clientHeight) return;
			const all = (sel) => Array.from(st.querySelectorAll(sel));
			// Dropped from the end, whole pieces only (never half a tile): the questions first, then the hours, then
			// the jump-to tiles; on the voice screen the fine print, the tagline, then the orb; on the sheet the call row.
			const drops = all('.sitestaffr-panel-hero-orb, .sitestaffr-panel-tagline, .sitestaffr-panel-fine-print').concat(all('.sitestaffr-panel-acts > .is-main'), all('.sitestaffr-panel-jumps > *'), all('.sitestaffr-panel-hours-block'), all('.sitestaffr-panel-tb'), all('.sitestaffr-panel-questions > li, .sitestaffr-panel-questions > .sitestaffr-panel-question, .sitestaffr-panel-chips > .sitestaffr-panel-question'));
			const labels = all('.sitestaffr-panel-label');
			drops.concat(labels).forEach((n) => { n.hidden = false; });
			st.removeAttribute('data-ssp-tight');
			const over = () => st.scrollHeight > st.clientHeight + 1;
			if (!over()) return;
			st.setAttribute('data-ssp-tight', '');
			for (let i = drops.length - 1; i >= 0 && over(); i--) drops[i].hidden = true;
			// A label whose list is gone goes with it.
			labels.forEach((l) => {
				const list = l.nextElementSibling;
				const kids = list ? Array.from(list.children) : [];
				if (kids.length && kids.every((k) => k.hidden)) l.hidden = true;
			});
		}

		close() {
			this.el.classList.remove('is-open');
			this.isOpen = false;
		}

		/** A new conversation starts with no card and nothing the last visitor told us. */
		resetContact() {
			this.contact = {};
			this.contactState = { editing: false, confirmed: false };
			this.detailsShown = false;
			this.changed = {};
			const card = this.el.querySelector('.sitestaffr-panel-contact');
			if (card) card.remove();
			const pad = this.el.querySelector('.sitestaffr-panel-notepad');
			if (pad) { pad.hidden = true; pad.innerHTML = ''; }
			const call = this._callEl();
			if (call) call.classList.remove('has-details');
		}

		/** The label the button gave a field, else the plain one. */
		_label(key) {
			const declared = (this.opts.notepadFields || []).filter((f) => f && String(f.key) === key && f.label)[0];
			return declared ? String(declared.label) : contactLabel(key);
		}

		_fields() {
			return contactFields(this.contact).map((f) => ({ key: f.key, label: this._label(f.key) }));
		}

		/**
		 * Called as each detail is saved. Nothing is listed while the visitor talks or types: a quiet check line
		 * goes into the transcript where it was saved ("Changed your email" when it replaces one), and the details
		 * card exists only from the read-back on, when it just follows along. `opts.silent` is for details carried
		 * over from the other mode, which the visitor has already seen.
		 */
		setContactField(key, value, opts) {
			if (!key || !value) return;
			const next = String(value);
			const prev = this.contact[key];
			if (prev === next) return;
			this.contact[key] = next;
			if (!(opts && opts.silent)) this._receipt(prev ? 'changed' : 'noted', key, next);
			if (this.detailsShown) {
				if (prev) this.changed[key] = true;
				this._renderDetails();
			}
		}

		/** A detail the visitor asked to drop (#375): a Removed line, and off the card if it is showing. */
		removeContactField(key) {
			if (!key || !this.contact[key]) return;
			delete this.contact[key];
			delete this.changed[key];
			this._receipt('removed', key);
			if (this.detailsShown) this._renderDetails();
		}

		/** The assistant read the details back: the one card appears (on a call, in the call's own card). */
		showDetails() {
			if (this.detailsShown || !Object.keys(this.contact).some((k) => this.contact[k])) return;
			if (this.screen !== 'call' && this.screen !== 'text') return;
			this.detailsShown = true;
			// On a call the card says it all (a corrected row is tagged), so the check lines make room for it.
			if (this.screen === 'call') this._callEl().querySelectorAll('.sitestaffr-panel-receipt').forEach((n) => n.remove());
			this._renderDetails();
		}

		/** What the assistant just said (a typed reply or a call line): a request to check the details is the read-back. */
		noteAgentText(text) {
			if (!this.detailsShown && Object.keys(this.contact).length >= 2 && isReadBack(text)) this.showDetails();
		}

		_renderDetails() {
			const filled = Object.keys(this.contact).some((k) => this.contact[k]);
			if (this.screen === 'call') {
				const pad = this.el.querySelector('.sitestaffr-panel-notepad');
				pad.innerHTML = callDetailsHtml(this._fields(), this.contact, this.changed);
				pad.hidden = !filled;
				this._callEl().classList.toggle('has-details', filled);
				return;
			}
			if (filled) {
				this._renderCard();
			} else {
				const card = this.el.querySelector('.sitestaffr-panel-contact');
				if (card) card.remove();
			}
		}

		/** Where the check line goes: under the captions on a call, after the last message in the conversation. */
		_receipt(kind, key, value) {
			if (this.screen === 'call' && this.detailsShown) return;
			const holder = document.createElement('template');
			holder.innerHTML = receiptHtml(kind, this._label(key), value);
			const node = holder.content.firstElementChild;
			node.setAttribute('data-turn', String(this.agentTurns));
			if (this.screen === 'call') {
				const box = this._callEl().querySelector('.sitestaffr-panel-captions');
				box.appendChild(node);
				box.hidden = false;
				return;
			}
			const list = this.el.querySelector('.sitestaffr-chat-messages');
			list.insertBefore(node, list.querySelector('.sitestaffr-chat-typing'));
			list.scrollTop = list.scrollHeight;
		}

		/** A mode change in the transcript: kind is 'talked' (with seconds), 'typing' or 'ended'. */
		addDivider(kind, seconds) {
			const list = this.el.querySelector('.sitestaffr-chat-messages');
			const holder = document.createElement('template');
			holder.innerHTML = dividerHtml(kind, seconds);
			list.insertBefore(holder.content.firstElementChild, list.querySelector('.sitestaffr-chat-typing'));
		}

		/** `focusFirst`: the visitor just pressed Edit, so the first input takes focus. A capture re-render never moves focus. */
		_renderCard(focusFirst) {
			const list = this.el.querySelector('.sitestaffr-chat-messages');
			let card = list.querySelector('.sitestaffr-panel-contact');
			if (!card) {
				card = document.createElement('div');
				card.className = 'sitestaffr-panel-contact';
				list.insertBefore(card, list.querySelector('.sitestaffr-chat-typing'));
			}
			// A re-render while the visitor is editing (a new detail was just captured) must not undo
			// their typing: keep what they changed and the field and caret they were in.
			const typed = {};
			let focusKey = null;
			let caret = null;
			if (this.contactState.editing) {
				const active = document.activeElement;
				card.querySelectorAll('.sitestaffr-panel-edit-input').forEach((input) => {
					const key = input.getAttribute('data-contact-key');
					if (input.value !== input.defaultValue) typed[key] = input.value;
					if (input === active) {
						focusKey = key;
						caret = [input.selectionStart, input.selectionEnd, input.selectionDirection];
					}
				});
			}
			card.innerHTML = contactCardHtml(this._fields(), this.contact, this.config.name, Object.assign({ look: this.config.look, changed: this.changed }, this.contactState));
			card.querySelectorAll('.sitestaffr-panel-edit-input').forEach((input) => {
				const key = input.getAttribute('data-contact-key');
				if (Object.prototype.hasOwnProperty.call(typed, key)) input.value = typed[key];
			});
			const target = (focusKey && card.querySelector('.sitestaffr-panel-edit-input[data-contact-key="' + focusKey.replace(/["\\]/g, '\\$&') + '"]')) ||
				(focusFirst ? card.querySelector('.sitestaffr-panel-edit-input') : null);
			if (target) {
				target.focus({ preventScroll: true });
				if (caret && target.getAttribute('data-contact-key') === focusKey) target.setSelectionRange(caret[0], caret[1], caret[2] || 'none');
			}
			list.scrollTop = list.scrollHeight;
		}

		_editContact(on) {
			this.contactState = { editing: on, confirmed: false };
			this._renderCard(on);
		}

		_saveContact() {
			this.el.querySelectorAll('.sitestaffr-panel-edit-input').forEach((input) => {
				const key = input.getAttribute('data-contact-key');
				const value = input.value.trim();
				if (!value || value === this.contact[key]) return;
				this.contact[key] = value;
				if (this.opts.onContactEdit) this.opts.onContactEdit(key, value);
			});
			this._editContact(false);
		}

		/* ===== CALL SCREEN (Front Desk, #395 Phase 3) =====
		   Everything the voice call adds to the panel lives in this block. The widget owns the call
		   (SiteStaffrCore); the panel only shows it and reports the visitor's three buttons. */

		_callEl() {
			return this.el.querySelector('.sitestaffr-panel-call');
		}

		/**
		 * Talk was pressed: a fresh call screen with nothing listed, "Connecting to AI Assistant...". `opts.resumed`
		 * is a call that picks up a typed chat: the earlier turns stay in the transcript and the screen says so.
		 */
		beginCall(opts) {
			this.resetContact();
			this.agentTurns = 0;
			this._callEl().querySelector('.sitestaffr-panel-continue').hidden = !(opts && opts.resumed);
			this._callEl().querySelectorAll('.sitestaffr-panel-receipt').forEach((n) => n.remove());
			this.callMuted = false;
			this.callState = 'connecting';
			this.callQuery = '';
			this.callNotice = '';
			// The header counts only once the call has connected, so it never reads 0:0x while Connecting.
			this._stopCallTimer();
			this.callSeconds = null;
			this._callEl().querySelectorAll('.sitestaffr-panel-caption').forEach((p) => {
				p.hidden = true;
				p.querySelector('.sitestaffr-panel-caption-text').textContent = '';
			});
			this._callEl().querySelector('.sitestaffr-panel-captions').hidden = true;
			this._renderMute();
			this.show('call');
			this.setCall({ state: 'connecting' });
			this._callEl().focus({ preventScroll: true });
		}

		/**
		 * One entry point for everything the call screen shows: { state, query, agentText, visitorText,
		 * seconds, muted, notice }. Captions are the last agent line and the last visitor line, each replacing the
		 * previous; an empty string hides one.
		 */
		setCall(c) {
			const call = this._callEl();
			const next = c || {};
			if (next.state !== undefined) {
				this.callState = next.state;
				call.setAttribute('data-call-state', next.state);
				// The orb says what is happening: animated waves while the assistant talks, a microphone otherwise.
				const core = call.querySelector('.sitestaffr-panel-orb-core');
				if (core) core.innerHTML = next.state === 'speaking' ? WAVE_HTML : icon('mic', 34);
			}
			if (Object.prototype.hasOwnProperty.call(next, 'query')) this.callQuery = next.query || '';
			// A notice (the muted check-in, #504) holds the status line until the visitor un-mutes.
			if (Object.prototype.hasOwnProperty.call(next, 'notice')) this.callNotice = next.notice || '';
			if (next.muted === false) this.callNotice = '';
			if (next.state !== undefined || Object.prototype.hasOwnProperty.call(next, 'query') || Object.prototype.hasOwnProperty.call(next, 'notice') || next.muted === false) {
				call.querySelector('.sitestaffr-panel-call-status').textContent = this.callNotice || callStatusText(this.callState, this.callQuery);
			}
			if (typeof next.agentText === 'string') {
				this._setCaption('is-ai', next.agentText);
				if (next.agentText) this._agentSpoke(next.agentText);
			}
			if (typeof next.visitorText === 'string') this._setCaption('is-visitor', next.visitorText);
			if (next.state !== undefined && !this.callTimer && this.screen === 'call' &&
				['listening', 'thinking', 'searching', 'speaking'].indexOf(next.state) !== -1) {
				this.startCallTimer();
			}
			if (typeof next.seconds === 'number') {
				this.callSeconds = next.seconds;
				this._renderCallSubtitle();
			}
			if (typeof next.muted === 'boolean') {
				this.callMuted = next.muted;
				this._renderMute();
			}
		}

		_setCaption(which, text) {
			const p = this._callEl().querySelector('.sitestaffr-panel-caption.' + which);
			p.querySelector('.sitestaffr-panel-caption-text').textContent = text;
			p.hidden = !text;
			// The box shows only while it has something to say.
			const box = this._callEl().querySelector('.sitestaffr-panel-captions');
			box.hidden = !box.querySelector('.sitestaffr-panel-caption:not([hidden]), .sitestaffr-panel-receipt');
		}

		/**
		 * The assistant finished a line. A check line stays through the reply to it and goes at the next one, so
		 * the screen shows what was just saved and never a growing list. The line may also be the read-back.
		 */
		_agentSpoke(text) {
			this.agentTurns += 1;
			this._callEl().querySelectorAll('.sitestaffr-panel-receipt').forEach((n) => {
				if (Number(n.getAttribute('data-turn')) <= this.agentTurns - 2) n.remove();
			});
			this.noteAgentText(text);
		}

		_renderMute() {
			const btn = this._callEl().querySelector('.sitestaffr-panel-call-btn.is-mute');
			btn.setAttribute('aria-pressed', this.callMuted ? 'true' : 'false');
			btn.classList.toggle('is-on', !!this.callMuted);
			btn.innerHTML = icon(this.callMuted ? 'mic' : 'micOff', 22) + '<small>' + esc(t(this.callMuted ? 'Unmute' : 'Mute')) + '</small>';
		}

		/** "AI assistant" stays in front of the call timer: the disclosure never goes (#250). */
		_renderCallSubtitle() {
			const sub = this.el.querySelector('.sitestaffr-chat-header-subtitle');
			if (sub) sub.innerHTML = subtitleHtml(t('Talking') + (this.callSeconds == null ? '' : DOT + callTimeText(this.callSeconds)));
			// Workshop: the big timer, and its status strip says what is happening instead of the hours.
			const timer = this.el.querySelector('.sitestaffr-panel-timer');
			if (timer && this.callSeconds != null) timer.textContent = callTimeText(this.callSeconds);
			const strip = this.el.querySelector('.sitestaffr-panel-status span');
			if (strip) strip.textContent = t('Talking');
		}

		/** The call connected (its first live state): the header counts up from here. */
		startCallTimer() {
			this._stopCallTimer();
			this.callStartedAt = Date.now();
			this.callSeconds = 0;
			if (this.screen === 'call') this._renderCallSubtitle();
			this.callTimer = setInterval(() => this.setCall({ seconds: (Date.now() - this.callStartedAt) / 1000 }), 1000);
		}

		_stopCallTimer() {
			if (this.callTimer) clearInterval(this.callTimer);
			this.callTimer = null;
		}

		_leaveCall() {
			this._stopCallTimer();
			this.refreshHours();
		}

		/**
		 * The call never got going (mic refused, plan limit, connection error): back to the first screen
		 * with nothing left over.
		 */
		abortCall() {
			this._stopCallTimer();
			this.resetContact();
			if (this.screen === 'call') this.show('start');
		}

		/**
		 * The call ended and the conversation moves to the transcript. A hang-up leaves the one details card (no
		 * inline Edit: decision 7); Type keeps the conversation going, so the card stays out unless the read-back
		 * already put it on screen. Returns whether there are details, so the widget carries them into the next text chat.
		 */
		endCall(opts) {
			this._stopCallTimer();
			if (this.screen !== 'call') return false;
			if (!this.isOpen) {
				this.resetContact();
				this.show('start');
				return false;
			}
			this.lastCallSeconds = this.callSeconds;
			const filled = Object.keys(this.contact).some((k) => this.contact[k]);
			const keep = filled && (!(opts && opts.typing) || this.detailsShown);
			this.contactState = { editing: false, confirmed: false, readOnly: !(opts && opts.typing) };
			this.show('text');
			const pad = this.el.querySelector('.sitestaffr-panel-notepad');
			pad.hidden = true;
			pad.innerHTML = '';
			this._callEl().classList.remove('has-details');
			this.detailsShown = keep;
			if (keep) this._renderCard();
			return filled;
		}

		_callAction(action) {
			const o = this.opts;
			if (action === 'call-mute') {
				this.setCall({ muted: !this.callMuted });
				if (o.onCallMute) o.onCallMute(this.callMuted);
			} else if (action === 'call-type') {
				if (o.onCallType) o.onCallType();
			} else if (action === 'call-end') {
				if (o.onCallEnd) o.onCallEnd();
			} else if (action === 'tell-us') {
				if (o.onTellUs) o.onTellUs();
			}
		}
	}

	/**
	 * Workshop's pill launcher shows whether anyone is in. The page may be cached, so the browser
	 * fills the hours in itself, on load and whenever the tab comes back.
	 */
	function syncLauncher() {
		const cfg = root.sitestaffr_widget_data && root.sitestaffr_widget_data.panel;
		if (!cfg || cfg.look !== 'workshop') return;
		const text = hoursLine(cfg.hours, new Date());
		document.querySelectorAll('#sitestaffr-widget .sitestaffr-widget-pill small').forEach((el) => {
			el.textContent = text;
			el.hidden = !text;
		});
	}
	/**
	 * Keeps the launcher's hours current: once a minute while the tab is visible (a tab left open across
	 * 6 PM must not say "Open now" at 7), nothing while it is hidden, and straight away when it returns.
	 */
	function watchLauncher(doc, sync, env) {
		const timers = env || root;
		let id = null;
		const start = () => { if (id === null) id = timers.setInterval(sync, 60000); };
		const stop = () => { if (id !== null) { timers.clearInterval(id); id = null; } };
		doc.addEventListener('visibilitychange', () => {
			if (doc.visibilityState === 'visible') { sync(); start(); } else stop();
		});
		if (doc.visibilityState !== 'hidden') start();
	}
	if (typeof document !== 'undefined') {
		const refresh = () => {
			syncLauncher();
			// A panel left open on its first screen refreshes its own hours too.
			const open = document.querySelector('.sitestaffr-panel.is-open');
			// A conversation by voice owns the header line ("Talking · 0:42"); the hours come back when it ends.
			if (open && open._panel && open._panel.screen !== 'call') open._panel.refreshHours();
		};
		if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', syncLauncher);
		else syncLauncher();
		watchLauncher(document, refresh);
	}

	/* ---------- the owner's live preview (Task 7.3) ----------
	   The owner screen frames the home page with a nonce-checked preview link; the server sets
	   preview.on only for that administrator. The widget then starts nothing, and this draws the
	   panel from what the owner screen posts: at once from the look arithmetic, then from the
	   server's own render of the unsaved settings. The conversation is a fixed, made-up script. */

	const PREVIEW_TYPE = 'sitestaffr-panel-preview';
	// The owner's colors and font (#609), as SiteStaffr_Panel_Look::own_colors() names them; sitestaffr-core.js copies the same list.
	const OWN_VARS = ['--ssp-own-bg', '--ssp-own-ink', '--ssp-own-card', '--ssp-own-muted', '--ssp-own-line',
		'--ssp-own-header', '--ssp-own-header-ink', '--ssp-own-buttons', '--ssp-own-buttons-ink',
		'--ssp-own-visitor', '--ssp-own-visitor-ink', '--ssp-own-assistant', '--ssp-own-assistant-ink',
		'--ssp-own-text', '--ssp-own-font'];
	const PREVIEW_STATES = ['start', 'text', 'contact', 'call'];
	const PREVIEW_ATTRS = ['data-ssp-look', 'data-ssp-bg', 'data-ssp-corners', 'data-ssp-font', 'data-ssp-mark', 'data-ssp-start', 'data-ssp-phone', 'data-ssp-beside', 'data-ssp-own', 'data-ssp-place'];
	const PREVIEW_VARS = ['--ss-brand', '--ss-brand-rgb', '--ss-brand-text', '--ss-radius', '--ss-site-font', '--ss-logo'].concat(OWN_VARS);
	// The parts the owner screen can point at (#609): each is the first of its selectors drawn in the panel.
	const PREVIEW_PARTS = {
		header: ['.sitestaffr-panel-header'],
		hours: ['.sitestaffr-panel-status', '.sitestaffr-chat-header-subtitle'],
		start: ['.sitestaffr-panel-start'],
		greeting: ['.sitestaffr-panel-greeting', '.sitestaffr-panel-hero-title'],
		modes: ['.sitestaffr-panel-modes', '.sitestaffr-panel-acts', '.sitestaffr-panel-talk'],
		questions: ['.sitestaffr-panel-questions', '.sitestaffr-panel-chips'],
		callline: ['.sitestaffr-panel-call-line'],
		messages: ['.sitestaffr-chat-messages'],
		visitor: ['.sitestaffr-chat-message--visitor'],
		assistant: ['.sitestaffr-chat-message--assistant'],
		input: ['.sitestaffr-chat-input-area']
	};
	const PREVIEW_SCRIPT = {
		visitor: 'Hi, do you have any openings this week?',
		reply: 'We do. Thursday morning and Friday afternoon are open. Which works better for you?',
		visitorAgain: 'Friday afternoon, please.',
		replyAgain: 'Friday it is. What name and phone number should the team use to confirm?',
		contact: { name: 'Marisol Pérez', phone: '(305) 555-0142' }
	};

	/** What the owner screen may say about the page's language: SiteStaffr's words, and the owner's words and questions for it. */
	function languageConfig(language) {
		const out = { words: language.words && typeof language.words === 'object' && !Array.isArray(language.words) ? language.words : null, dir: language.dir === 'rtl' ? 'rtl' : 'ltr' };
		['greeting', 'talk', 'talkNote', 'type', 'typeNote'].forEach((key) => {
			if (typeof language[key] === 'string') out[key] = language[key];
		});
		if (Array.isArray(language.questions)) out.questions = language.questions.filter((q) => typeof q === 'string').slice(0, 3);
		return out;
	}

	/** The look's attributes for unsaved settings (SiteStaffr_Panel_Look::attr_map(), from the shared arithmetic). */
	function previewAttrs(looks, settings, logo) {
		const r = resolve(looks, settings || {});
		return {
			'data-ssp-look': r.panel_look,
			'data-ssp-bg': r.panel_background,
			'data-ssp-corners': r.panel_corners,
			'data-ssp-mark': r.panel_mark === 'logo' && !logo ? 'initial' : r.panel_mark,
			'data-ssp-start': r.panel_start,
			'data-ssp-phone': r.panel_phone,
			'data-ssp-place': r.panel_desktop || 'float',
			'data-ssp-beside': r.panel_beside === 'logo' && !logo ? 'initial' : (r.panel_beside || 'none'),
			// Corners in pixels and fonts beyond Like my site and Clean need the server's render; until it comes, the closest.
			'data-ssp-font': r.panel_font === 'site' || r.panel_font === 'clean' ? r.panel_font : 'own'
		};
	}

	/** Puts a built panel into one of the owner screen's four states with the made-up conversation. */
	function stagePreview(view, state) {
		const s = PREVIEW_SCRIPT;
		if (state === 'call' && view.canTalk) {
			view.beginCall();
			view.setCall({ state: 'speaking', visitorText: s.visitorAgain, agentText: s.replyAgain });
			view.setContactField('name', s.contact.name);
			return;
		}
		if (state === 'start') {
			view.show('start');
			return;
		}
		view.show('text');
		view.addMessage('user', s.visitor);
		view.addMessage('assistant', esc(s.reply));
		if (state === 'contact') {
			view.addMessage('user', s.visitorAgain);
			view.addMessage('assistant', esc(s.replyAgain));
			view.setContactField('name', s.contact.name);
			view.setContactField('phone', s.contact.phone);
			view.showDetails();
		}
	}

	/**
	 * The preview on one page: `apply(message)` redraws the panel. Returns null when the page has no
	 * widget to draw from.
	 */
	function startPreview(doc, data) {
		const widget = doc.getElementById('sitestaffr-widget');
		if (!widget || !data || !data.panel) return null;
		const position = (String(widget.className).match(/\bposition-([a-z-]+)/) || [])[1] || 'bottom-right';
		let config = Object.assign({}, data.panel);
		let state = 'start';
		let view = null;
		let built = '';

		/** Everything a build draws from, the frame's size included (the first screen fits itself to it): the same key, the same picture. */
		function drawnFrom() {
			const win = doc.defaultView || {};
			return JSON.stringify([PREVIEW_ATTRS.map((name) => widget.getAttribute(name)), PREVIEW_VARS.map((prop) => widget.style.getPropertyValue(prop)), config, state, win.innerWidth, win.innerHeight]);
		}

		function build() {
			built = drawnFrom();
			if (view) {
				view._stopCallTimer();
				view.el.remove();
			}
			// The words are one module-level setting: a preview drawn in Spanish must not leave them for the English one.
			useWords(config.words || null);
			view = new SiteStaffrPanelView({ root: widget, config, canTalk: config.mode !== 'text', canType: config.mode !== 'voice', soundsEnabled: false, position });
			view.open();
			stagePreview(view, state);
			widget.classList.add('panel-open');
		}

		function apply(msg) {
			const render = msg.render && typeof msg.render === 'object' ? msg.render : null;
			if (render) {
				const attrs = render.attrs || {};
				PREVIEW_ATTRS.forEach((name) => {
					// Corners may be pixels and data-ssp-own a list (#609): letters, digits, underscores, hyphens and spaces only.
					if (typeof attrs[name] === 'string' && /^[a-z0-9_ -]*$/.test(attrs[name])) widget.setAttribute(name, attrs[name]);
				});
				const vars = render.vars || {};
				PREVIEW_VARS.forEach((prop) => {
					if (typeof vars[prop] === 'string') widget.style.setProperty(prop, vars[prop]);
					else widget.style.removeProperty(prop);
				});
				if (render.config && typeof render.config === 'object') config = render.config;
			} else if (msg.looks && typeof msg.looks === 'object' && msg.settings && typeof msg.settings === 'object') {
				const attrs = previewAttrs(msg.looks, msg.settings, config.logo);
				Object.keys(attrs).forEach((name) => { if (/^[a-z0-9_ -]*$/.test(String(attrs[name]))) widget.setAttribute(name, attrs[name]); });
				const r = resolve(msg.looks, msg.settings);
				// The owner's words and phone line are plain values (#609): drawn at once, not after the server's render.
				config = Object.assign({}, config, {
					look: r.panel_look, start: r.panel_start,
					greeting: String(r.panel_greeting || ''), talk: String(r.panel_talk || ''), talkNote: String(r.panel_talk_note || ''),
					type: String(r.panel_type || ''), typeNote: String(r.panel_type_note || ''), phoneLine: r.panel_phone_line !== 'off'
				});
			}
			// The page's language as the owner screen shows it (#703): its words, and in the second language the owner's.
			if (msg.language && typeof msg.language === 'object') config = Object.assign({}, config, languageConfig(msg.language));
			if (PREVIEW_STATES.indexOf(msg.state) !== -1) state = msg.state;
			// A message that changes nothing (a render matching the draw before it) must not redraw: each
			// build opens the panel again, which the owner sees as a flash (#606).
			if (drawnFrom() !== built) build();
		}

		build();
		return { apply, get view() { return view; } };
	}

	const rectOf = (r) => ({ top: r.top, right: r.right, bottom: r.bottom, left: r.left });

	/**
	 * Where each part of a drawn panel is, in the frame's own pixels (#609): the panel itself, and each
	 * PREVIEW_PARTS entry that is on screen. The owner screen outlines a changed part from it.
	 */
	function previewParts(el) {
		const out = { panel: rectOf(el.getBoundingClientRect()) };
		Object.keys(PREVIEW_PARTS).forEach((part) => {
			for (const selector of PREVIEW_PARTS[part]) {
				const node = el.querySelector(selector);
				const r = node && node.getBoundingClientRect();
				if (r && r.width > 0 && r.height > 0) {
					out[part] = rectOf(r);
					break;
				}
			}
		});
		return out;
	}

	/**
	 * Listens for the owner screen, and only in preview mode, only inside a frame, only to the parent
	 * window on this site's own origin. Then says it is ready, so the screen sends its first state.
	 * After each redraw it tells the screen where the panel and its parts are, so the screen can keep
	 * it in view (#578) and outline what changed (#609). `begin` stands in for startPreview() in the unit tests.
	 */
	function listenForPreview(win, doc, data, begin) {
		if (!data || !data.preview || data.preview.on !== true || !win.parent || win.parent === win) return null;
		const preview = (begin || startPreview)(doc, data);
		if (!preview) return null;
		const origin = win.location.origin;
		win.addEventListener('message', (e) => {
			if (e.origin !== origin || e.source !== win.parent) return;
			const msg = e.data;
			if (!msg || typeof msg !== 'object' || msg.type !== PREVIEW_TYPE) return;
			// On phones (#609): the owner's page shows behind the chat, so Full screen and Half sheet differ.
			if (doc.body && doc.body.classList) doc.body.classList.toggle('sitestaffr-panel-preview-page', msg.page === true);
			preview.apply(msg);
			report();
			// The first screen fits itself to the frame on the next frame: say where the parts settled.
			if (win.requestAnimationFrame) win.requestAnimationFrame(() => win.requestAnimationFrame(report));
		});
		function report() {
			const el = preview.view && preview.view.el;
			if (!el) return;
			const parts = previewParts(el);
			win.parent.postMessage({ type: PREVIEW_TYPE + '-drawn', box: parts.panel, parts }, origin);
		}
		// Late web fonts move the parts too.
		if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(report);
		win.parent.postMessage({ type: PREVIEW_TYPE + '-ready' }, origin);
		return preview;
	}

	/**
	 * Starts listenForPreview once the page has parsed. The widget's data is printed beside the
	 * widget's own script, which can come after this file (a button on the page enqueues the panel
	 * first), so it is read at DOMContentLoaded, never when this file runs.
	 */
	function bootPreview(win, doc, begin) {
		const go = () => (win.sitestaffr_widget_data !== undefined ? listenForPreview(win, doc, win.sitestaffr_widget_data, begin) : null);
		if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', go);
		else go();
	}

	if (typeof document !== 'undefined') bootPreview(root, document);

	/* ---------- The widgets' side of "the assistant cannot answer" (#534) ----------
	   The floating widget and the in-page button drive their conversation with the same code, so the part
	   that decides what the visitor sees and does lives here once. A widget supplies: panel, chatInstance,
	   core, mode, _panelTalk(), _newChat(), _minimalChat(), and the _entitlementInactive / _dailyCapReached flags. */

	const cantAnswer = {
		/** An error line from the text chat. Talk appears only when the server said voice works AND this panel can still talk. */
		notice(widget, text, info) {
			if (!widget.panel || !info || !Array.isArray(info.actions)) {
				widget.appendPlainNotice(info && info.plain ? info.plain : text);
				return;
			}
			const canTalk = !!(info.voiceAvailable && widget.panel.canTalk && widget.core && widget.mode !== 'text');
			const actions = info.actions.filter((a) => a !== 'talk' || canTalk);
			widget.panel.addNotice(text, actions);
		},

		/** A tap on one of the notice buttons. */
		act(widget, kind) {
			if (kind === 'retry') {
				if (widget.chatInstance) widget.chatInstance.retryLast();
			} else if (kind === 'leave') {
				cantAnswer.help(widget, { canGoBack: true });
			} else if (kind === 'talk') {
				widget._panelTalk();
			} else if (kind === 'newchat') {
				widget._newChat();
			}
		},

		/**
		 * The leave-your-details form. With a question already asked it replaces the conversation and carries the
		 * question over; with none (the assistant could not answer on open) it is the first screen.
		 * opts: { canGoBack }
		 */
		help(widget, opts) {
			const o = opts || {};
			const chat = widget.chatInstance;
			const turns = chat && Array.isArray(chat.transcript) ? chat.transcript : [];
			const asked = turns.filter((t) => t.role === 'user').pop();
			const question = asked ? asked.text : '';
			const memory = (chat && chat.contactMemory) || {};
			widget.panel.showHelp({
				mode: asked || o.canGoBack ? 'conversation' : 'start',
				question,
				values: { name: memory.name, phone: memory.phone, email: memory.email },
				canGoBack: !!o.canGoBack,
				onSubmit: (values) => {
					const target = widget.chatInstance || widget._minimalChat();
					['name', 'phone', 'email'].forEach((k) => { if (values[k]) target.contactMemory[k] = values[k]; });
					target.contactMemory.reason = values.message;
					target.submissionSource = 'contact_form';
					// The question is already in the transcript; only an edited or new message is added.
					if (values.message !== question) {
						target.transcript.push({ role: 'user', text: values.message, timestamp: new Date().toISOString() });
					}
					target.endConversation(widget._entitlementInactive ? 'entitlement_contact' : (o.canGoBack ? 'error_contact' : 'daily_cap_contact'));
				}
			});
			// A reached limit shows the form again on the next open; a busy chat does not.
			if (!o.canGoBack) widget._dailyCapReached = true;
		}
	};

	// The page's words are known before any panel is built: the launcher's hours use them too.
	const pageData = root.sitestaffr_widget_data || root.sitestaffr_button_data;
	if (pageData && pageData.panel && pageData.panel.words) useWords(pageData.panel.words);

	const Panel = root.SiteStaffrPanel || {};
	Panel.model = { CONTROL_KEYS, STYLE_KEYS, KEPT_KEYS, overrides, resolve, changes, switchLook, backToLook, setControl };
	Object.assign(Panel, { titleBlockHtml, hoursLine, hoursSummary, jumpActions, telHref, watchLauncher, headerHtml, startHtml, messageHtml, greetingFor, shortName, contactCardHtml, contactFields, esc, icon, Panel: SiteStaffrPanelView });
	Object.assign(Panel, { useWords, t, fmt, unfmt });
	Object.assign(Panel, { endSentence, noticeHtml, teamInLine, helpFormHtml, helpSentHtml, cantAnswer });
	Object.assign(Panel, { rowHtml, detailRowHtml, callDetailsHtml, receiptHtml, dividerHtml, isReadBack, callStatusText, callTimeText, callHtml, sheetAfterDrag, openPhoneSheet });
	Object.assign(Panel, { previewAttrs, previewParts, startPreview, listenForPreview, bootPreview, PREVIEW_SCRIPT, PREVIEW_PARTS, OWN_VARS });
	Object.assign(Panel, { mixHex, luminance, contrast, inkFor, surfaceHex, longHex });
	root.SiteStaffrPanel = Panel;

	if (typeof module !== 'undefined' && module.exports) module.exports = Panel;
})(typeof window !== 'undefined' ? window : globalThis);
