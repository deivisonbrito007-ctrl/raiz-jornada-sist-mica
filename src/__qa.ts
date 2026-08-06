import fs from "fs";
import { gerarRelatorioPdf } from "./lib/raiz-relatorio";
// @ts-ignore
globalThis.__save = true;
const eixos = ["Pai","Mãe","Filhos","Ancestralidade","Dinheiro","Saúde","Relacionamentos","Propósito"].map((n,i)=>({nome:n,liberado:i<6,total:5,concluidos:i,datasConclusao:["2026-07-01T10:00:00Z"]}));
const diario = Array.from({length:7},(_,i)=>({texto:"Reflexão sobre ação e coração: "+"percebi que a relação com meu pai mudou depois da prática. ".repeat(4+i),created_at:`2026-07-0${i+1}T10:00:00Z`,conteudos:i%2?{titulo:"Prática do olhar",eixos:{nome:"Pai"}}:null}));
gerarRelatorioPdf({nome:"Ana Coração",email:"ana@exemplo.com",metaSemanal:3,eixos,datasConclusao:["2026-07-01T10:00:00Z"],diario});
