# Documento de requisitos (PRD)

## 01 Resumen
- **Nombre:** Inmobiliaria CRM (provisorio).
- **Frase:** las consultas de WhatsApp, Instagram, Messenger y la web en un solo lugar, con un bot que ofrece tus propiedades y agenda visitas.
- **Descripción:** micro app multiempresa para inmobiliarias. Centraliza los mensajes, la IA contesta, califica y agenda, y reparte los leads entre los asesores de cada oficina. Se diferencia de Kommo/Clientify por ser simple y pensada para inmobiliarias de Argentina.

## 02 Problema
- Las consultas llegan por 4 canales y se pierden o se contestan tarde (fuera de horario, fines de semana).
- Los asesores repiten las mismas respuestas (precio, expensas, requisitos) y las visitas se anotan en papel o en WhatsApp.

## 03 Objetivo
- Que una inmobiliaria conteste el 100% de las consultas en menos de 1 minuto y agende visitas sin intervención humana.

## 04 Usuarios
- Dueño (admin): configura, ve todo, suma al equipo.
- Encargado de oficina: ve lo de su oficina.
- Asesor (ventas): atiende sus leads y sus visitas.
- Superadmin (equipo de la plataforma): da de alta inmobiliarias.
- Cliente final: escribe por WhatsApp, Instagram, Messenger o el chat de la web.

## 05 Funcionalidades (versión Pro)
- **Bandeja única de leads** con resumen de IA, prioridad, pipeline, tareas y asesor.
- **Canales:** WhatsApp, Instagram, Messenger y chat de la web (código para pegar en la web de la inmobiliaria).
- **Bot con IA:** ofrece propiedades de la cartera, califica (caliente/tibio/frío), toma datos, agenda visitas, toma pedidos de tasación y deriva a un asesor.
- **Propiedades:** cartera de venta y alquiler con foto, precio, expensas y estado.
- **Visitas:** agenda semanal por oficina y asesor, estados, aviso de choques, confirmación por WhatsApp y recordatorio al asesor la tarde anterior.
- **Reparto por ronda** de leads por oficina.
- **Configuración:** datos de la empresa y de la marca, respuestas del bot (con ejemplos para arrancar), equipo (altas con clave temporal), oficinas y canales.
- **Superadmin:** alta de inmobiliarias sin SQL, suspender y reactivar.
- **Demo pública** `/demo` con simulador de canales (sin Meta ni base).

## 06 Fuera de alcance (por ahora)
- Administración de alquileres (contratos, cobros, ajustes por índice).
- Publicación en portales (Zonaprop, Argenprop).
- Reservas, operaciones, honorarios, finanzas.
- Mensajes al cliente fuera de la ventana de 24 h de WhatsApp (necesitan plantilla aprobada por Meta).
- Subida de fotos a un almacenamiento propio (hoy la foto es una dirección web).

## 07 Modelo de negocio
- Básico USD 40/mes: WhatsApp, propiedades, visitas, CRM, 1 a 2 asesores.
- Pro USD 80/mes: los 3 canales + chat web, calificación, tasaciones, hasta 6 asesores, tablero.
- Instalación opcional USD 50 (se puede regalar en las primeras ventas).

## 08 Métricas de éxito
- 3 inmobiliarias pagando en los primeros 3 meses.
- Costo de IA por inmobiliaria por debajo de USD 10/mes.
