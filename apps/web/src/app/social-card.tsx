type SocialCardProps = {
  title: string;
  subtitle: string;
  eyebrow: string;
};

const bg = "#060609";
const surface = "#10111A";
const surfaceSoft = "#141624";
const border = "rgba(255,255,255,0.08)";
const green = "#00FF85";
const blue = "#6EA8FF";
const red = "#FF5C7A";
const text = "#F5F7FB";
const textDim = "#A4ACBA";
const textSoft = "#70798B";

function Pill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "green" | "blue";
}) {
  const styles =
    tone === "green"
      ? { background: "rgba(0,255,133,0.12)", color: "#9AF8C5", borderColor: "rgba(0,255,133,0.18)" }
      : tone === "blue"
        ? { background: "rgba(110,168,255,0.12)", color: "#BDD4FF", borderColor: "rgba(110,168,255,0.18)" }
        : { background: "rgba(255,255,255,0.05)", color: textDim, borderColor: border };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "999px",
        padding: "10px 16px",
        border: `1px solid ${styles.borderColor}`,
        background: styles.background,
        color: styles.color,
        fontSize: "18px",
        fontWeight: 600,
        letterSpacing: "-0.02em",
      }}
    >
      {label}
    </div>
  );
}

export function SocialCard({ title, subtitle, eyebrow }: SocialCardProps) {
  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        position: "relative",
        overflow: "hidden",
        background: bg,
        color: text,
        fontFamily: "Inter",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 12% 18%, rgba(0,255,133,0.20), transparent 28%), radial-gradient(circle at 84% 14%, rgba(110,168,255,0.16), transparent 24%), radial-gradient(circle at 84% 82%, rgba(255,92,122,0.12), transparent 26%), linear-gradient(180deg, rgba(255,255,255,0.02), transparent 34%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.45,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />

      <div
        style={{
          position: "absolute",
          right: "-80px",
          top: "-100px",
          width: "320px",
          height: "320px",
          borderRadius: "999px",
          background: "rgba(0,255,133,0.10)",
          filter: "blur(80px)",
        }}
      />

      <div
        style={{
          display: "flex",
          width: "100%",
          padding: "56px",
          gap: "30px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "60%",
            padding: "40px",
            borderRadius: "36px",
            border: `1px solid ${border}`,
            background: "linear-gradient(180deg, rgba(16,17,26,0.95), rgba(8,9,14,0.93))",
            boxShadow: "0 24px 80px rgba(0,0,0,0.38)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "26px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "56px",
                  height: "56px",
                  borderRadius: "18px",
                  background: "rgba(0,255,133,0.12)",
                  border: "1px solid rgba(0,255,133,0.18)",
                  color: green,
                  fontFamily: "Clash Display",
                  fontSize: "28px",
                  fontWeight: 700,
                  letterSpacing: "-0.06em",
                }}
              >
                S
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span
                  style={{
                    fontFamily: "Clash Display",
                    fontSize: "15px",
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: green,
                    fontWeight: 700,
                  }}
                >
                  {eyebrow}
                </span>
                <span
                  style={{
                    fontSize: "22px",
                    fontWeight: 600,
                    letterSpacing: "-0.04em",
                    color: text,
                  }}
                >
                  onsiren.xyz
                </span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              <div
                style={{
                  fontFamily: "Clash Display",
                  fontSize: "72px",
                  lineHeight: 0.92,
                  letterSpacing: "-0.07em",
                  fontWeight: 700,
                  maxWidth: "92%",
                }}
              >
                {title}
              </div>
              <div
                style={{
                  maxWidth: "88%",
                  fontSize: "26px",
                  lineHeight: 1.32,
                  color: textDim,
                }}
              >
                {subtitle}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <Pill label="Kalshi" tone="green" />
            <Pill label="Polymarket" tone="blue" />
            <Pill label="One clean trading flow" />
          </div>
        </div>

        <div
          style={{
            display: "flex",
            width: "40%",
            padding: "22px",
            borderRadius: "36px",
            border: `1px solid ${border}`,
            background: "linear-gradient(180deg, rgba(12,13,20,0.96), rgba(7,8,12,0.94))",
            boxShadow: "0 24px 80px rgba(0,0,0,0.42)",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: "100%",
              gap: "16px",
              borderRadius: "28px",
              border: `1px solid ${border}`,
              background: `linear-gradient(180deg, rgba(7,30,20,0.95), ${surface} 60%)`,
              padding: "24px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", gap: "8px" }}>
                <Pill label="Politics" tone="neutral" />
                <Pill label="Poly" tone="blue" />
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: "74px",
                  height: "38px",
                  borderRadius: "999px",
                  border: "1px solid rgba(0,255,133,0.2)",
                  background: "rgba(0,255,133,0.08)",
                  color: green,
                  fontSize: "16px",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                Live
              </div>
            </div>

            <div
              style={{
                fontFamily: "Clash Display",
                fontSize: "34px",
                lineHeight: 1.02,
                letterSpacing: "-0.055em",
                fontWeight: 700,
                maxWidth: "96%",
              }}
            >
              Will the Fed cut rates before June?
            </div>

            <div style={{ display: "flex", gap: "14px" }}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  gap: "8px",
                  padding: "18px",
                  borderRadius: "22px",
                  background: "rgba(0,0,0,0.35)",
                  border: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <span
                  style={{
                    fontFamily: "Clash Display",
                    fontSize: "15px",
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: textSoft,
                    fontWeight: 700,
                  }}
                >
                  Yes
                </span>
                <span
                  style={{
                    fontFamily: "Clash Display",
                    fontSize: "46px",
                    lineHeight: 1,
                    letterSpacing: "-0.05em",
                    color: green,
                    fontWeight: 700,
                  }}
                >
                  61%
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  gap: "8px",
                  padding: "18px",
                  borderRadius: "22px",
                  background: "rgba(0,0,0,0.35)",
                  border: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <span
                  style={{
                    fontFamily: "Clash Display",
                    fontSize: "15px",
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: textSoft,
                    fontWeight: 700,
                  }}
                >
                  No
                </span>
                <span
                  style={{
                    fontFamily: "Clash Display",
                    fontSize: "46px",
                    lineHeight: 1,
                    letterSpacing: "-0.05em",
                    color: red,
                    fontWeight: 700,
                  }}
                >
                  39%
                </span>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderRadius: "22px",
                border: `1px solid ${border}`,
                background: surfaceSoft,
                padding: "16px 18px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "18px", color: textDim, fontSize: "18px" }}>
                <span>$38.9M</span>
                <span>1.7M traders</span>
              </div>
              <span
                style={{
                  color: green,
                  fontSize: "20px",
                  fontWeight: 700,
                  letterSpacing: "-0.03em",
                }}
              >
                Match tokens below
              </span>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "68px",
                borderRadius: "22px",
                background: green,
                color: "#04110A",
                fontFamily: "Clash Display",
                fontSize: "24px",
                fontWeight: 700,
                letterSpacing: "-0.03em",
              }}
            >
              Pick a side
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
