---
name: EXLINK Studio
description: A compact liquid-glass bench for a mature desktop debugging assistant.
colors:
  text: '#efedf7'
  muted: '#b0adc3'
  dim: '#9a96b0'
  window: '#101018'
  surface: '#1c1c29'
  input: '#282737'
  hover: '#363347'
  selected: '#3d345c'
  border: '#ffffff17'
  grid: '#aaa5cb19'
  accent: '#bdadff'
  primary: '#9c86f4'
  primary-hover: '#b19cf9'
  primary-text: '#211535'
  rx: '#88d7c5'
  tx: '#b8a6ff'
  warning: '#f2c78b'
  danger: '#f3a5ae'
  sidebar: '#252332'
  edge: '#ffffff1d'
  edge-bright: '#ffffff32'
  channel-0: '#a798ff'
  channel-1: '#73d8c2'
  channel-2: '#edbb7b'
  channel-3: '#e99fc6'
  channel-4: '#7dbef5'
  channel-5: '#c4d58a'
  channel-6: '#dc9be9'
  channel-7: '#8ccad1'
  light-text: '#282536'
  light-muted: '#625e74'
  light-dim: '#716981'
  light-window: '#e8e8f2'
  light-surface: '#f7f6fc'
  light-input: '#f8f7fc'
  light-hover: '#e6e1f1'
  light-selected: '#e0d8f6'
  light-border: '#67578224'
  light-grid: '#6757821a'
  light-accent: '#6b4cc7'
  light-primary: '#7048c0'
  light-primary-hover: '#633bb3'
  light-primary-text: '#fff'
  light-rx: '#247b66'
  light-tx: '#7652bd'
  light-warning: '#98651f'
  light-danger: '#b1485e'
  light-sidebar: '#f4f0fc'
  light-edge: '#ffffffd9'
  light-edge-bright: '#fff'
  light-channel-0: '#7855ce'
  light-channel-1: '#208973'
  light-channel-2: '#ad741e'
  light-channel-3: '#b75c8d'
  light-channel-4: '#327cb7'
  light-channel-5: '#6f862d'
  light-channel-6: '#a451b1'
  light-channel-7: '#348a94'
typography:
  headline:
    fontFamily: '''Segoe UI Variable Text'',''Segoe UI'',''Microsoft YaHei UI'',sans-serif'
    fontSize: 19px
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: -.5px
  panel-title:
    fontFamily: '''Segoe UI Variable Text'',''Segoe UI'',''Microsoft YaHei UI'',sans-serif'
    fontSize: 13px
    fontWeight: 600
    lineHeight: 1.5
  body:
    fontFamily: '''Segoe UI Variable Text'',''Segoe UI'',''Microsoft YaHei UI'',sans-serif'
    fontSize: 12px
    lineHeight: 1.5
  label:
    fontFamily: '''Segoe UI Variable Text'',''Segoe UI'',''Microsoft YaHei UI'',sans-serif'
    fontSize: 11px
    lineHeight: 1.5
  button:
    fontFamily: '''Segoe UI Variable Text'',''Segoe UI'',''Microsoft YaHei UI'',sans-serif'
    fontSize: 12px
    fontWeight: 550
    lineHeight: 1.4
  log-data:
    fontFamily: '''Cascadia Code'',Consolas,''Microsoft YaHei UI'',monospace'
    fontSize: 12px
    lineHeight: 1.5
  channel-stat:
    fontFamily: Consolas,monospace
    fontSize: 10px
rounded:
  input: 8px
  button: 9px
  navigation: 10px
  panel: 14px
  rail: 18px
  icon: 7px
  badge: 5px
spacing:
  action-gap: 4px
  compact-gap: 6px
  control-gap: 7px
  composer-block: 8px
  pane-gap: 12px
  shell-gap: 14px
components:
  button-primary:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.primary-text}'
    typography: '{typography.button}'
    rounded: '{rounded.button}'
    padding: 6px 10px
  button-primary-hover:
    backgroundColor: '{colors.primary-hover}'
  button-primary-light:
    backgroundColor: '{colors.light-primary}'
    textColor: '{colors.light-primary-text}'
  button-primary-hover-light:
    backgroundColor: '{colors.light-primary-hover}'
  button-secondary:
    backgroundColor: '{colors.input}'
    textColor: '{colors.text}'
    rounded: '{rounded.button}'
    padding: 6px 10px
  button-quiet:
    textColor: '{colors.muted}'
    rounded: '{rounded.button}'
    padding: 6px 10px
  button-icon:
    textColor: '{colors.muted}'
    rounded: '{rounded.icon}'
    padding: 5px
    width: 28px
    height: 28px
  input:
    backgroundColor: '{colors.input}'
    textColor: '{colors.text}'
    rounded: '{rounded.input}'
    padding: 7px 9px
  navigation:
    textColor: '{colors.muted}'
    rounded: '{rounded.navigation}'
    padding: 9px 5px
  navigation-active:
    backgroundColor: '{colors.selected}'
    textColor: '{colors.text}'
  demo-badge:
    textColor: '{colors.accent}'
    rounded: '{rounded.badge}'
    padding: 2px 7px
  panel:
    textColor: '{colors.text}'
    rounded: '{rounded.panel}'
  switch:
    backgroundColor: '{colors.input}'
    width: 36px
    height: 21px
    rounded: '{rounded.panel}'
  channel-row:
    textColor: '{colors.text}'
    height: 30px
---

# Design System: EXLINK Studio

## Overview

**Creative North Star: "The Compact Glass Bench"**

EXLINK Studio is a mature, advanced desktop debugging assistant expressed as a compact glass bench. The approved purple folded-ribbon E anchors the identity; dark graphite, violet reflections and a companion pale-glass theme provide expressive Liquid Glass around readable operational data.

Density serves long bench sessions: thin task bars, restrained headings, aligned bytes and adjacent channel values keep the session in view. Glass is a material layer, while text, keyboard focus and signal colors remain explicit. The existing system UI stack is functional application typography rather than a decorative display face.

**Key Characteristics:**
- Expressive liquid glass with reflected edges and fluid ambient clouds.
- Compact operational density with aligned monospaced data.
- Purple folded-ribbon E identity in dark and light themes.
- Visible source, focus and signal state throughout the session.

## Colors

Violet carries the folded-ribbon identity; graphite and pale lavender neutrals support data, with independent signal colors for acquisition and plotted channels. Unprefixed frontmatter colors are the dark defaults; `light-` entries are exact light overrides of the corresponding CSS properties. CSS remains the implementation source in `src/styles.css`.

### Primary

- **Ribbon Violet** (`primary`, `primary-hover`, `primary-text`): action fill, hover and paired label ink, with corresponding `light-` theme tokens.
- **Reflected Lavender** (`accent`): focus rings, active icons and selected controls; distinct from the stronger action fill.

### Secondary

- **Received Mint** (`rx`) and **Transmitted Violet** (`tx`): directional traffic states, accompanied by labels.
- **Signal Spectrum** (`channel-0` through `channel-7`): violet, mint, amber, rose, blue, lime, orchid and cyan, each with a light override. These eight implemented slots repeat across channels; they are not 32 unique hues.
- **Caution Amber** (`warning`) and **Alert Rose** (`danger`): semantic feedback primitives. Current warning and error text helpers both use danger ink; warning is not a universal text assignment.

### Neutral

- **Graphite / Pale Cloud** (`window`): underlying canvas.
- **Working Surface** (`surface`, `sidebar`, `input`): solid fallback, rail/popover backing and editable fields.
- **Hover / Selected Veil** (`hover`, `selected`): state fills.
- **Primary / Muted / Dim Ink** (`text`, `muted`, `dim`): content, supporting labels and low-emphasis metadata.
- **Fine Dividers and Reflections** (`border`, `grid`, `edge`, `edge-bright`): boundaries, plot grid and glass reflection. Preserve source alpha values rather than flattening against a guessed background.

**The Paired Ink Rule.** Keep each theme's primary fill, hover fill and label ink together; primary action ink is a separate token from ordinary text.

**The Signal Identity Rule.** Use the same channel color for its curve, checkbox and swatch; pair color with names and numeric values.

## Typography

**Body and heading font:** Segoe UI Variable Text, Segoe UI, Microsoft YaHei UI, sans-serif. **Data font:** Cascadia Code, Consolas, Microsoft YaHei UI, monospace. Compact channel statistics and some instrument readouts use Consolas directly. The root is (14px / 1.5), with compact local sizes. There is no separate display face or promotional type ramp.

### Hierarchy

- **Workspace headline:** semibold (19px, 600, inherited 1.5 line height, -.5px tracking).
- **Panel title:** semibold (13px, 600, inherited 1.5 line height).
- **Body / controls:** compact (12px); primary labels use (550, 1.4 line height).
- **Supporting label:** small (11px); metadata reaches (10px), with channel columns (9px, or 8px in narrow layouts).
- **Raw log data:** (12px); timestamps (10.5px). Channel statistics use (10px), reduced to (9px) in constrained layouts.
- **Local exceptions:** settings title (21px); power primary reading (76px / 1.5, Consolas), secondary readings (31px). These are contextual components rather than a general display hierarchy.

**The Data Alignment Rule.** Use monospaced, tabular numeric data for bytes, timestamps and channel readings; keep interface labels in the UI stack.

## Layout

The final compact cascade is authoritative. The shell has a (110px) rail, (14px) gap and outer padding (10px 14px 8px 10px). Navigation uses horizontal icon-and-text rows (minimum 43px). The heading is (55px); pane headers (40px), log toolbar (39px), log rows (24px), waveform toolbar (35px), footer/status bars (28px). Local spacing uses (4px-14px) rather than a fabricated universal progression.

Serial panes use a (1.5fr / 1fr) log-to-waveform split with a (12px) gap. Collapsing the plot expands logs; the composer remains beneath logs with a field (40px) tall. Wide channel rows are (30px), aligning label/current/min/max. Settings use a category rail and scrolling forms; tools have functional layouts.

At widths up to (1360px), secondary toolbar metadata is reduced. At (1179px) and below, the plot stacks above logs at (196px) tall with a (280px) channel region. When also at heights up to (760px), the plot is (162px) and channel rows (22px). A separate (1180px-1300px) query compresses channel columns. The (1000px) query reduces settings/tool and heading content; the final cascade still preserves the compact (110px) rail. This is desktop adaptation, not an invented mobile layout.

## Elevation & Depth

Translucent gradient-backed glass sits over violet/blue ambient clouds, with a bright inset top edge, faint side edge and diffuse shadow. Exact dark/light `--glass` backgrounds remain in source and in the sidecar snippet; layered gradients are not scalar color tokens. Shared glass blur is (30px), saturation (135%); connection popover blur is (40px), saturation (160%).

### Shadow Vocabulary

- **Panel ambient:** theme `--shadow`, with `inset 0 1px 0 var(--edge-bright), inset 1px 0 0 #ffffff07`.
- **Primary action:** `inset 0 1px 0 #ffffff26, 0 3px 9px #32225430`.
- **Connection overlay:** `inset 0 1px 0 var(--edge-bright), 0 22px 65px #0006`.

**The Reflected Edge Rule.** Glass combines a translucent surface, a thin bright edge and diffuse depth; preserve the solid-surface preference as an equally legible presentation.

Buttons transition background, color and shadow over (160ms); switches transition fill and thumb position over (150ms). Reduced motion disables transitions, animations and smooth scrolling. Glass-off removes blur and shadow from shared glass surfaces, uses solid surface fill, and replaces clouds with the window color.

## Shapes

Soft corners express the material: rail and popover (18px), working panels and toast (14px), navigation (10px), buttons (9px), fields and segments (8px), icon buttons (7px), demo badges (5px). Borders are thin (1px) and often translucent. Status dots are circular; curve swatches are thin horizontal marks. The folded E stays the approved raster identity rather than a text or generic geometric substitute.

## Components

### Buttons

Compact and softly reflective. Standard padding is (6px 10px), minimum height (30px), icon gap (7px). Primary actions combine primary fill and paired ink with top gloss and diffuse depth; hover uses primary-hover. Header actions have (31px) minimum height, primary horizontal padding (13px). Secondary controls are input-toned; quiet controls use muted ink. Icon buttons are (28px) squares with (5px) padding; local toolbar/status variants are smaller. Focus uses an accent outline (2px), offset (3px). Disabled opacity is (.43). Running primary actions use selected fill and accent text.

### Chips / Tags

The demo badge is a source-state label (10px), accent ink on a translucent violet fill and border, padding (2px 7px), corners (5px). It is not a general filter-chip system. Segments use small buttons inside an (8px) container and a filled active state.

### Cards / Containers

Working panels use (14px) corners, clip their contents and carry the glass material. Their title strip is (40px) with (13px) horizontal padding and a divider; content spacing follows the task. The connection dialog uses (18px) corners, (330px) width and a stronger shadow. It focuses the first control, closes on Escape/outside pointer and restores opener focus.

### Inputs / Fields

Fields use input fill, subtle (1px) borders, corners (8px), padding (7px 9px), and (12px) text. Caret and keyboard focus use accent. Placeholders use muted ink at full opacity. Search embeds a line SVG and promotes its border on focus. Error helper text uses danger; no further validated-field chrome is established. Switches are (36px x 21px) with a (15px) thumb translating (13px).

### Navigation

Rail rows use (12px) labels and (18px) SVG icons. Active rows combine selected fill and reflected edges with accent icons and main text ink. Settings and theme controls sit below tools. Narrow desktop mode preserves the rail rather than introducing mobile tabs.

### Channel table and log

Channel identity is shared by checkbox, swatch and curve. Current/min/max values have names and units, aligned right in monospaced columns. Hidden channels reduce opacity. Raw logs use (24px) rows, explicit direction and a fixed timestamp column. Collapsing the plot preserves composer input and ingest.

## Do's and Don'ts

### Do:
- Do preserve the approved folded purple E asset and its existing proportions.
- Do keep operational controls compact and the composer anchored beneath logs.
- Do use theme variables for text, focus, actions and channel colors.
- Do retain visible keyboard focus, explicit demo labeling and the reduced-motion preference.
- Do stack the compact plot above logs in narrow desktop windows.

### Don't:
- Don't replace the approved ribbon E with a generic symbol.
- Don't replace the operational workspace with dashboard metric-card framing.
- Don't mix primary action fill and ink tokens from different themes.
- Don't hide signal identity behind color alone or let glass obscure raw data.
- Don't promote one-off instrument reading sizes into the general heading scale.

Not canonized: superseded pre-compact declarations, instrument sizes as global type roles, or a claim that the scoped contrast ship verdict is a new whole-interface audit. No application defect was repaired in this documentation pass.
