import { Request, Response } from "express";

/**
 * Evolution API controller
 *
 * GET /api/evolution/qrcode
 *
 * Usa EVOLUTION_API_URL e EVOLUTION_API_KEY para chamar
 * GET {EVOLUTION_API_URL}/instance/connect/integrai
 * e retorna o QR Code (base64) para o frontend.
 */

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE = "integrai"; // conforme instruído pelo usuário

export const getEvolutionQrCode = async (_req: Request, res: Response) => {
  try {
    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      return res.status(500).json({
        error: "Evolution API not configured",
        missing: {
          EVOLUTION_API_URL: !EVOLUTION_API_URL,
          EVOLUTION_API_KEY: !EVOLUTION_API_KEY,
        },
      });
    }

    const url = `${EVOLUTION_API_URL.replace(/\/$/, "")}/instance/connect/${EVOLUTION_INSTANCE}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        apikey: EVOLUTION_API_KEY,
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => undefined);
      return res.status(response.status).json({
        error: "Failed to fetch QR code from Evolution API",
        status: response.status,
        body: text,
      });
    }

    const data = await response.json();

    // A API costuma retornar algo como { qrCode: "data:image/png;base64,..." } ou campos similares.
    const qrCode =
      (data.qrCode as string) ||
      (data.qrcode as string) ||
      (data.qr_code as string) ||
      (data.qr as string) ||
      undefined;

    return res.status(200).json({
      raw: data,
      qrcode: qrCode,
    });
  } catch (error) {
    console.error("Erro ao obter QR Code da Evolution API:", error);
    return res.status(500).json({ error: "Internal server error while fetching Evolution QR code" });
  }
};
