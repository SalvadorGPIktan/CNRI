exports.handler = async function (event) {
  try {
    const serviciosPermitidos = ["rojo", "amarillo", "verde", "azul"];
    const servicio = event.queryStringParameters?.service;

    if (!serviciosPermitidos.includes(servicio)) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ error: "Servicio no válido" })
      };
    }

    const baseUrl = process.env.IKTAN_API_BASE_URL;

    if (!baseUrl) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          error: "IKTAN_API_BASE_URL no está configurada"
        })
      };
    }

    const params = new URLSearchParams(
      event.queryStringParameters || {}
    );

    params.delete("service");

    const query = params.toString();

    const url =
      `${baseUrl.replace(/\/$/, "")}/${servicio}` +
      (query ? `?${query}` : "");

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json"
      }
    });

    const buffer = await response.arrayBuffer();

    // IKTAN responde en ISO-8859-1
    const decoder = new TextDecoder("iso-8859-1");

    const decoded = decoder
      .decode(buffer)
      .replace(/^\uFEFF/, "")
      .trim();

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: {
          "Content-Type": "application/json; charset=utf-8"
        },
        body: JSON.stringify({
          error: "Error consultando IKTAN",
          status: response.status,
          detail: decoded.slice(0, 300)
        })
      };
    }

    /*
     * Se vuelve a convertir el JSON después de leerlo como ISO-8859-1.
     * Así Netlify lo entrega al navegador correctamente como UTF-8
     * y se evitan problemas con acentos como:
     * México, Querétaro, Yucatán, etc.
     */
    let payload;

    try {
      payload = decoded
        ? JSON.parse(decoded)
        : [];
    } catch (error) {
      return {
        statusCode: 502,
        headers: {
          "Content-Type": "application/json; charset=utf-8"
        },
        body: JSON.stringify({
          error: "IKTAN devolvió una respuesta JSON inválida"
        })
      };
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      },
      body: JSON.stringify(payload)
    };

  } catch (error) {
    console.error(error);

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json; charset=utf-8"
      },
      body: JSON.stringify({
        error: "Error interno del proxy"
      })
    };
  }
};
