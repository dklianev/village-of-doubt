import type { Meta, StoryObj } from "@storybook/react-vite";

type TokenInfo = {
  name: string;
  contrast?: string;
};

const TOKEN_GROUPS: Record<string, TokenInfo[]> = {
  surfaces: [
    { name: "--ds-surface-paper", contrast: "-" },
    { name: "--ds-surface-paper-deep", contrast: "-" },
    { name: "--ds-surface-paper-edge", contrast: "-" },
    { name: "--ds-surface-scene", contrast: "-" },
    { name: "--ds-surface-scene-deep", contrast: "-" },
  ],
  inks: [
    { name: "--ds-ink-primary", contrast: "10.4:1 AAA" },
    { name: "--ds-ink-soft", contrast: "5.8:1 AA" },
    { name: "--ds-ink-faint", contrast: "3.6:1 large" },
    { name: "--ds-ink-scene", contrast: "12.1:1 AAA" },
    { name: "--ds-ink-scene-soft", contrast: "7.2:1 AA" },
  ],
  accents: [
    { name: "--ds-accent-blood" },
    { name: "--ds-accent-blood-deep" },
    { name: "--ds-accent-gold" },
    { name: "--ds-accent-gold-deep" },
    { name: "--ds-accent-gold-soft" },
    { name: "--ds-accent-green" },
  ],
};

function TokenSwatch({ name, contrast }: TokenInfo) {
  return (
    <div
      style={{
        display: "grid",
        gap: "8px",
        padding: "12px",
        border: "1px solid oklch(0.86 0.035 75)",
        borderRadius: "var(--ds-radius-tile)",
      }}
    >
      <div
        style={{
          height: "64px",
          borderRadius: "var(--ds-radius-tile)",
          background: `var(${name})`,
          border: "1px solid oklch(0.20 0.05 60 / 0.1)",
        }}
      />
      <code style={{ fontSize: "11px", fontFamily: "ui-monospace, monospace" }}>
        {name}
      </code>
      {contrast ? (
        <small style={{ fontSize: "10px", color: "oklch(0.40 0.018 60)" }}>
          {contrast}
        </small>
      ) : null}
    </div>
  );
}

const meta: Meta = {
  title: "Foundation/Tokens",
  parameters: { layout: "fullscreen" },
};

export default meta;

type Story = StoryObj;

export const Colors: Story = {
  render: () => (
    <div style={{ display: "grid", gap: "32px", padding: "32px", maxWidth: "900px" }}>
      {Object.entries(TOKEN_GROUPS).map(([group, tokens]) => (
        <section key={group}>
          <h3
            style={{
              fontFamily: "Noto Serif, Iowan Old Style, Georgia, serif",
              margin: "0 0 16px",
              textTransform: "capitalize",
            }}
          >
            {group}
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
              gap: "12px",
            }}
          >
            {tokens.map((token) => (
              <TokenSwatch key={token.name} {...token} />
            ))}
          </div>
        </section>
      ))}
    </div>
  ),
};

export const Typography: Story = {
  render: () => (
    <div style={{ display: "grid", gap: "24px", padding: "32px" }}>
      {["display", "h1", "h2", "h3", "h4", "lede", "body", "body-sm", "eyebrow", "meta"].map(
        (scale) => (
          <div
            key={scale}
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: "16px",
              borderBottom: "1px solid oklch(0.86 0.035 75)",
              paddingBottom: "8px",
            }}
          >
            <code style={{ width: "180px", fontSize: "11px", color: "oklch(0.40 0.018 60)" }}>
              --ds-type-{scale}
            </code>
            <span
              style={{
                fontSize: `var(--ds-type-${scale})`,
                fontFamily: "Noto Serif, Iowan Old Style, Georgia, serif",
              }}
            >
              Селото оцеля
            </span>
          </div>
        ),
      )}
    </div>
  ),
};

export const Spacing: Story = {
  render: () => (
    <div style={{ display: "grid", gap: "8px", padding: "32px" }}>
      {[1, 2, 3, 4, 6, 8, 10, 12].map((step) => (
        <div key={step} style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <code style={{ width: "120px", fontSize: "11px", color: "oklch(0.40 0.018 60)" }}>
            --ds-space-{step}
          </code>
          <div
            style={{
              height: "16px",
              width: `var(--ds-space-${step})`,
              background: "var(--ds-accent-gold)",
              borderRadius: "2px",
            }}
          />
        </div>
      ))}
    </div>
  ),
};

export const Motion: Story = {
  render: () => (
    <div style={{ display: "grid", gap: "16px", padding: "32px", maxWidth: "600px" }}>
      <h3 style={{ fontFamily: "Noto Serif, Iowan Old Style, Georgia, serif", margin: 0 }}>
        Продължителности
      </h3>
      {[
        ["instant", "90ms - натискане, фокус"],
        ["quick", "180ms - toast, меню"],
        ["base", "280ms - модал"],
        ["stage", "500ms - смяна на фаза"],
      ].map(([tier, description]) => (
        <div
          key={tier}
          style={{ borderTop: "1px solid oklch(0.86 0.035 75)", paddingTop: "12px" }}
        >
          <code style={{ fontSize: "11px" }}>--ds-duration-{tier}</code>
          <p style={{ margin: "4px 0", fontSize: "14px" }}>{description}</p>
        </div>
      ))}
    </div>
  ),
};
