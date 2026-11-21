# SiteStaffr widget (demo build)

The real SiteStaffr floating widget for static mockups: the plugin's own stylesheets and chat window script,
driven by canned replies. Nothing is sent anywhere.

Copied unmodified from `SiteStaffr/sitestaffr-plugin` at commit `565a0e5fac04b551c1f52bc68e5f4021376739cc`
(`main`, plugin 1.80.0, 2026-11-21):

| File here | From the plugin |
| --- | --- |
| `sitestaffr-widget.css` | `public/css/sitestaffr-widget.css` (launcher and tooltip) |
| `sitestaffr-chat-panel.css` | `public/css/sitestaffr-chat-panel.css` (chat window base) |
| `sitestaffr-panel-looks.css` | `public/css/sitestaffr-panel-looks.css` (the eight looks) |
| `sitestaffr-panel.js` | `public/js/sitestaffr-panel.js` (builds the chat window, its screens and the call screen) |

`demo.js` is ours. It prints the launcher markup that `public/modules/class-sitestaffr-widget-render-handler.php`
prints, computes the same colors and custom properties as `SiteStaffr_Widget_Settings_Provider` and
`SiteStaffr_Panel_Look`, copies them onto the chat window as `SiteStaffrChatStyle.apply()` in
`public/js/sitestaffr-core.js` does, and stands in for `public/js/sitestaffr-widget.js` without the server.
Its header comment lists the `data-*` options.

## Refreshing from a newer plugin

```sh
cd /home/mario/Projects/sitestaffr-plugin && git fetch origin
C=$(git rev-parse origin/main); D=/home/mario/Projects/advanced-pest-mockups/assets/sitestaffr-widget
for f in sitestaffr-widget.css sitestaffr-chat-panel.css sitestaffr-panel-looks.css; do git show $C:public/css/$f > $D/$f; done
git show $C:public/js/sitestaffr-panel.js > $D/sitestaffr-panel.js
```

Then update the commit above, and check `git diff $OLD $C -- public/js/sitestaffr-widget.js
public/modules/class-sitestaffr-widget-render-handler.php public/modules/class-sitestaffr-panel-look.php` for
markup or color changes `demo.js` must follow. Use `origin/main` without checking it out: the plugin
checkout is shared.
