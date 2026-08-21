#!/usr/bin/env python3
"""Gera as telas de abertura (apple-touch-startup-image) do PWA no iOS.

Reaproveita o simbolo Raiz em alta resolucao sobre o fundo floresta da marca,
para que a abertura do app instalado apareca nitida em vez de uma tela branca.

Uso: python3 scripts/gerar-splash-ios.py <caminho-do-simbolo.png>
"""
import sys, os
from PIL import Image, ImageDraw

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DESTINO = os.path.join(RAIZ, "public", "splash")
FUNDO = (27, 42, 29)
BRILHO = (178, 76, 46)

TELAS = [
    (1290, 2796), (1179, 2556), (1284, 2778), (1170, 2532), (1125, 2436),
    (1242, 2688), (828, 1792), (750, 1334),
    (1536, 2048), (1668, 2388), (2048, 2732),
]


def aura(largura, altura, centro_y):
    camada = Image.new("RGB", (largura, altura), FUNDO)
    px = camada.load()
    raio = max(largura, altura) * 0.55
    cx, cy = largura / 2, centro_y
    passo = 2
    for y in range(0, altura, passo):
        for x in range(0, largura, passo):
            d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5 / raio
            t = max(0.0, 1.0 - d) ** 2 * 0.30
            cor = tuple(int(FUNDO[i] + (BRILHO[i] - FUNDO[i]) * t) for i in range(3))
            for dy in range(passo):
                for dx in range(passo):
                    if x + dx < largura and y + dy < altura:
                        px[x + dx, y + dy] = cor
    return camada


def main():
    origem = sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, "public/icon-512.png")
    marca = Image.open(origem).convert("RGBA")
    os.makedirs(DESTINO, exist_ok=True)
    for largura, altura in TELAS:
        centro_y = altura * 0.44
        tela = aura(largura, altura, centro_y)
        alvo = min(largura, altura) * 0.34
        escala = alvo / marca.height
        m = marca.resize((max(1, round(marca.width * escala)), round(alvo)), Image.LANCZOS)
        tela.paste(m, (round((largura - m.width) / 2), round(centro_y - m.height / 2)), m)
        caminho = os.path.join(DESTINO, f"splash-{largura}x{altura}.png")
        tela.save(caminho, optimize=True)
        print("gerado", os.path.relpath(caminho, RAIZ))


if __name__ == "__main__":
    main()
