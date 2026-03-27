type SocialCardProps = {
  title: string;
  subtitle: string;
  eyebrow: string;
};

const bg = "#060609";
const surface = "#0F0F18";
const grid = "rgba(255,255,255,0.05)";
const green = "#00FF85";
const red = "#FF4560";
const text = "#F5F7FB";
const textDim = "#9FA6B2";
const tokenBlue = "#65C8FF";

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
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          opacity: 0.75,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 18% 22%, rgba(0,255,133,0.2), transparent 28%), radial-gradient(circle at 86% 82%, rgba(255,69,96,0.18), transparent 30%), radial-gradient(circle at 70% 20%, rgba(0,255,133,0.1), transparent 24%)",
        }}
      />

      <div
        style={{
          display: "flex",
          width: "100%",
          padding: "56px",
          gap: "36px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "58%",
            padding: "36px",
            borderRadius: "32px",
            border: `1px solid ${grid}`,
            background: "linear-gradient(180deg, rgba(15,15,24,0.92), rgba(7,8,12,0.9))",
            boxShadow: "0 20px 80px rgba(0,0,0,0.35)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "14px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "58px",
                  height: "58px",
                  borderRadius: "18px",
                  background: "rgba(0,255,133,0.12)",
                  border: "1px solid rgba(0,255,133,0.2)",
                  color: green,
                  fontSize: "28px",
                  fontWeight: 800,
                  letterSpacing: "-0.06em",
                }}
              >
                S
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span
                  style={{
                    fontFamily: "Clash Display",
                    fontSize: "16px",
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: green,
                    fontWeight: 700,
                  }}
                >
                  {eyebrow}
                </span>
                <span
                  style={{
                    marginTop: "4px",
                    fontSize: "22px",
                    color: text,
                    fontWeight: 600,
                    letterSpacing: "-0.04em",
                  }}
                >
                  onsiren.xyz
                </span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div
                style={{
                  fontFamily: "Clash Display",
                  fontSize: "60px",
                  lineHeight: 1,
                  letterSpacing: "-0.06em",
                  fontWeight: 700,
                }}
              >
                {title}
              </div>
              <div
                style={{
                  maxWidth: "88%",
                  fontSize: "28px",
                  lineHeight: 1.35,
                  color: textDim,
                }}
              >
                {subtitle}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "18px" }}>
            {[
              { value: "24K+", label: "Active markets" },
              { value: "Dual", label: "Prediction x token flow" },
              { value: "Live", label: "Kalshi + Solana routing" },
            ].map((stat) => (
              <div
                key={stat.label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  flex: 1,
                  padding: "18px 20px",
                  borderRadius: "22px",
                  border: `1px solid ${grid}`,
                  background: "rgba(255,255,255,0.025)",
                }}
              >
                <span
                  style={{
                    fontFamily: "Clash Display",
                    fontSize: "34px",
                    color: green,
                    fontWeight: 700,
                    letterSpacing: "-0.05em",
                  }}
                >
                  {stat.value}
                </span>
                <span
                  style={{
                    fontSize: "16px",
                    color: textDim,
                  }}
                >
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            width: "42%",
            padding: "30px",
            borderRadius: "32px",
            border: `1px solid ${grid}`,
            background: "linear-gradient(180deg, rgba(15,15,24,0.96), rgba(8,8,12,0.92))",
            boxShadow: "0 20px 80px rgba(0,0,0,0.4)",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: "100%",
              borderRadius: "24px",
              border: `1px solid ${grid}`,
              background: "rgba(255,255,255,0.02)",
              padding: "26px",
              gap: "18px",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                borderRadius: "22px",
                border: `1px solid ${grid}`,
                background: "rgba(255,255,255,0.02)",
                padding: "22px",
              }}
            >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <span
                  style={{
                    fontFamily: "Clash Display",
                    fontSize: "14px",
                    textTransform: "uppercase",
                    letterSpacing: "0.18em",
                    color: green,
                    fontWeight: 700,
                  }}
                >
                  Signal from Kalshi
                </span>
                <span
                  style={{
                    maxWidth: "88%",
                    fontFamily: "Clash Display",
                    fontSize: "34px",
                    lineHeight: 1.18,
                    letterSpacing: "-0.05em",
                    fontWeight: 700,
                  }}
                >
                  Will the Fed cut rates before June 2026?
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "72px",
                  height: "72px",
                  borderRadius: "22px",
                  background: "rgba(0,255,133,0.08)",
                  border: "1px solid rgba(0,255,133,0.16)",
                  color: green,
                  fontSize: "18px",
                  fontWeight: 700,
                }}
              >
                LIVE
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "26px" }}>
              {[
                { label: "Yes", price: "72c", accent: green, bg: "rgba(0,255,133,0.08)" },
                { label: "No", price: "28c", accent: red, bg: "rgba(255,69,96,0.08)" },
              ].map((row) => (
                <div
                  key={row.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderRadius: "18px",
                    padding: "18px 20px",
                    background: row.bg,
                    border: `1px solid ${row.accent}22`,
                  }}
                >
                  <span
                    style={{
                      fontSize: "26px",
                      fontWeight: 600,
                    }}
                  >
                    {row.label}
                  </span>
                  <span
                    style={{
                      fontFamily: "Clash Display",
                      fontSize: "28px",
                      fontWeight: 700,
                      color: row.accent,
                      letterSpacing: "-0.05em",
                    }}
                  >
                    {row.price}
                  </span>
                </div>
              ))}
            </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                borderRadius: "22px",
                border: `1px solid ${grid}`,
                background: "rgba(255,255,255,0.02)",
                padding: "22px",
                gap: "14px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <span
                    style={{
                      fontFamily: "Clash Display",
                      fontSize: "14px",
                      textTransform: "uppercase",
                      letterSpacing: "0.18em",
                      color: tokenBlue,
                      fontWeight: 700,
                    }}
                  >
                    Token response
                  </span>
                  <span
                    style={{
                      fontFamily: "Clash Display",
                      fontSize: "28px",
                      lineHeight: 1.1,
                      letterSpacing: "-0.05em",
                      fontWeight: 700,
                    }}
                  >
                    BONK, BAGS, and narrative memes in one view
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minWidth: "86px",
                    padding: "12px 14px",
                    borderRadius: "999px",
                    background: "rgba(101,200,255,0.1)",
                    border: "1px solid rgba(101,200,255,0.18)",
                    color: tokenBlue,
                    fontSize: "16px",
                    fontWeight: 700,
                  }}
                >
                  Dex live
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px" }}>
                {[
                  { symbol: "BONK", move: "+18%", accent: green },
                  { symbol: "BAGS", move: "+9%", accent: tokenBlue },
                  { symbol: "CT", move: "54 hits", accent: red },
                ].map((token) => (
                  <div
                    key={token.symbol}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      flex: 1,
                      gap: "8px",
                      borderRadius: "18px",
                      padding: "16px",
                      background: "rgba(255,255,255,0.025)",
                      border: `1px solid ${grid}`,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "Clash Display",
                        fontSize: "22px",
                        lineHeight: 1,
                        fontWeight: 700,
                        letterSpacing: "-0.05em",
                      }}
                    >
                      {token.symbol}
                    </span>
                    <span
                      style={{
                        fontSize: "16px",
                        color: token.accent,
                        fontWeight: 600,
                      }}
                    >
                      {token.move}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: "auto",
                paddingTop: "6px",
                color: textDim,
                fontSize: "16px",
              }}
            >
              <span>Prediction markets x meme tokens</span>
              <span>Kalshi data • DFlow routing • Solana execution</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
