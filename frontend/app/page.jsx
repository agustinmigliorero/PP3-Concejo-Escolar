"use client";

import { useState, useEffect } from "react";

function Page() {
  const [nombre, setNombre] = useState("");
  const fetchNombre = async () => {
    const response = await fetch("http://92.113.39.212:8000");
    if (!response.ok) {
      throw new Error("Failed to fetch nombre");
    }
    const data = await response.json();
    setNombre(data.nombre);
  };
  useEffect(() => {
    fetchNombre();
  }, []);
  return (
    <div>
      <h1>Hola!</h1>
      <h2>RESPUESTA API: {nombre}</h2>
    </div>
  );
}

export default Page;
