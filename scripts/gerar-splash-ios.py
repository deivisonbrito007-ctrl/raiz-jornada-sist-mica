#!/usr/bin/env python3
"""Gera as telas de abertura (apple-touch-startup-image) do PWA no iOS.

Reaproveita o simbolo Raiz em alta resolucao sobre o fundo floresta da marca,
para que a abertura do app instalado apareca nitida em vez de uma tela branca.

Uso: python3 scripts/gerar-splash-ios.py <caminho-do-simbolo.png>
"""
import sys, os
from PIL import Image, ImageDraw, ImageFilter

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DESTINO = os.path.join(RAIZ, "public", "splash")
FUNDO = (27, 42, 29)
BRILHO = (178, 76, 46)
CREME = (243, 235, 216)

TELAS = [
    (1290, 2796), (1179, 2556), (1284, 2778), (1170, 2532), (1125, 2436),
    (1242, 2688), (828, 1792), (750, 1334),
    (1536, 2048), (1668, 2388), (2048, 2732),
]


def aura(largura, altura, centro_y):
    """Degrade radial suave: calculado pequeno e ampliado com bicubico para
    evitar faixas visiveis (banding) no fundo escuro."""
    pequeno_l, pequeno_a = 96, round(96 * altura / largura)
    base = Image.new("RGB", (pequeno_l, pequeno_a), FUNDO)
    px = base.load()
    cx, cy = pequeno_l / 2, pequeno_a * (centro_y / altura)
    raio = max(pequeno_l, pequeno_a) * 0.62
    for y in range(pequeno_a):
        for x in range(pequeno_l):
            d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5 / raio
            t = max(0.0, 1.0 - d) ** 1.7 * 0.42
            px[x, y] = tuple(int(FUNDO[i] + (BRILHO[i] - FUNDO[i]) * t) for i in range(3))
    return base.resize((largura, altura), Image.BICUBIC).filter(
        ImageFilter.GaussianBlur(radius=max(largura, altura) * 0.01)
    )


def main():
    origem = sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, "public/icon-512.png")
    marca = Image.open(origem).convert("RGBA")
    os.makedirs(DESTINO, exist_ok=True)
    for largura, altura in TELAS:
        centro_y = altura * 0.44
        tela = aura(largura, altura, centro_y)
        # disco creme suave atras do simbolo, para o desenho escuro respirar
        disco_r = round(min(largura, altura) * 0.30)
        disco = Image.new("L", (disco_r * 2, disco_r * 2), 0)
        dd = ImageDraw.Draw(disco)
        dd.ellipse((0, 0, disco_r * 2 - 1, disco_r * 2 - 1), fill=235)
        disco = disco.filter(ImageFilter.GaussianBlur(radius=disco_r * 0.16))
        tela.paste(
            Image.new("RGB", disco.size, CREME),
            (round(largura / 2 - disco_r), round(centro_y - disco_r)),
            disco,
        )

        alvo = min(largura, altura) * 0.34
        escala = alvo / marca.height
        m = marca.resize((max(1, round(marca.width * escala)), round(alvo)), Image.LANCZOS)
        tela.paste(m, (round((largura - m.width) / 2), round(centro_y - m.height / 2)), m)
        caminho = os.path.join(DESTINO, f"splash-{largura}x{altura}.png")
        tela.save(caminho, optimize=True)
        print("gerado", os.path.relpath(caminho, RAIZ))


if __name__ == "__main__":
    main()
