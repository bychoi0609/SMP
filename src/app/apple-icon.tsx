import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(160deg, #dbeafe 0%, #bfdbfe 100%)",
          borderRadius: 40,
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 110,
          }}
        >
          ☀️
        </div>
      </div>
    ),
    { ...size },
  );
}
