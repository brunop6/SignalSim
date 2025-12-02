# Documentação Didática - SignalSim
## Sistemas de Comunicação Analógica: Da Teoria à Prática

### Índice
1. [Introdução](#1-introdução)
2. [Fundamentos de Modulação Analógica](#2-fundamentos-de-modulação-analógica)
3. [Modulação em Amplitude (AM)](#3-modulação-em-amplitude-am)
4. [Modulação Angular: FM e PM](#4-modulação-angular-fm-e-pm)
5. [Single Sideband (SSB)](#5-single-sideband-ssb)
6. [Demodulação de Sinais](#6-demodulação-de-sinais)
7. [Multiplexação por Divisão de Frequência](#7-multiplexação-por-divisão-de-frequência)
8. [Filtragem Digital](#8-filtragem-digital)
9. [Guia Prático do Sistema](#9-guia-prático-do-sistema)
10. [Experimentos Sugeridos](#10-experimentos-sugeridos)

---

## 1. Introdução

### 1.1 Objetivos da Documentação

Esta documentação foi desenvolvida para servir como material de apoio ao ensino de **Sistemas de Comunicação Analógica**, estabelecendo uma ponte entre os conceitos teóricos e sua implementação prática. O sistema **SignalSim** permite visualizar e experimentar com diferentes técnicas de modulação, demodulação e multiplexação em tempo real.

### 1.2 Por Que Estudar Modulação?

Em sistemas de comunicação, raramente transmitimos sinais em sua forma original (banda base). A **modulação** é o processo de modificar uma onda portadora de alta frequência com o sinal de informação, permitindo:

- **Transmissão eficiente**: Antenas de tamanhos práticos para diferentes frequências
- **Multiplexação**: Múltiplos sinais compartilhando o mesmo meio
- **Proteção contra ruído**: Diferentes técnicas oferecem diferentes robustez
- **Regulamentação**: Alocação de bandas de frequência específicas

### 1.3 Arquitetura do Sistema

O SignalSim simula um sistema de comunicação completo:

```
┌─────────────┐      ┌─────────┐      ┌──────────────┐
│ Transmissor │ ───▶ │  Canal  │ ───▶ │   Receptor   │
│ (Modulação) │      │  (Mux)  │      │(Demodulação) │
└─────────────┘      └─────────┘      └──────────────┘
```

**Componentes principais:**
- **Transmissor**: Gera sinais de banda base e os modula
- **Canal**: Multiplexa sinais e aplica filtros (simula o meio de transmissão)
- **Receptor**: Demodula e recupera o sinal original

---

## 2. Fundamentos de Modulação Analógica

### 2.1 Conceitos Básicos

#### 2.1.1 Sinal de Informação (Banda Base)

O **sinal de mensagem** m(t) contém a informação que queremos transmitir:

```
m(t) = A·sin(2πfₘt + φ)
```

Onde:
- A: Amplitude do sinal
- fₘ: Frequência da mensagem (tipicamente baixa, < 20 kHz para voz)
- φ: Fase inicial

**No código** (`transmitter.service.ts`):
```typescript
// Geração de sinal senoidal de banda base
for (let i = 0; i < N; i++) {
  const t = x[i];
  y[i] = amplitude * Math.sin(2 * Math.PI * frequency * t + phaseRad) + offset;
}
```

#### 2.1.2 Portadora

A **portadora** c(t) é uma senóide de alta frequência que será modificada:

```
c(t) = Aс·cos(2πfсt)
```

Onde:
- Aс: Amplitude da portadora
- fс: Frequência da portadora (muito maior que fₘ)

**Critério fundamental**: fс >> fₘ (tipicamente fс > 10·fₘ)

#### 2.1.3 Teorema da Amostragem

Para representar um sinal digitalmente, a **frequência de amostragem** fs deve obedecer:

```
fs ≥ 2·fₘₐₓ  (Teorema de Nyquist-Shannon)
```

Onde fₘₐₓ é a maior frequência presente no sinal.

**No sistema**: O código valida automaticamente:
```typescript
// Validação no transmitter.component.ts
const requiredFsForModulation = 2 * (fc + fmax);
if (fs < requiredFsForModulation) {
  // Aviso de possível aliasing
}
```

### 2.2 Domínio do Tempo vs. Domínio da Frequência

Um dos conceitos mais importantes em telecomunicações é a **dualidade tempo-frequência**.

#### Transformada de Fourier

Qualquer sinal periódico pode ser decomposto em uma soma de senóides:

```
X(f) = ∫ x(t)·e^(-j2πft) dt
```

**Implementação no código** (`fourier-transform.service.ts`):
```typescript
// FFT (Fast Fourier Transform) - algoritmo eficiente
fft(x: number[]): Complex[] {
  // Implementação do algoritmo Cooley-Tukey
  // Complexidade: O(N log N) vs O(N²) da DFT direta
}
```

#### Visualização Espectral

O sistema calcula e exibe o **espectro de magnitude**, mostrando as componentes de frequência:

```typescript
computeSpectrum(signal: SignalData, fs: number, maxFreq?: number): SignalData {
  const fft = this.fft(Array.from(signal.y));
  // Magnitude: |X(f)| = sqrt(Re² + Im²)
  const magnitude = Math.sqrt(re * re + im * im);
}
```

---

## 3. Modulação em Amplitude (AM)

### 3.1 AM-DSB (Double Sideband with Carrier)

#### 3.1.1 Equação Fundamental

```
s(t) = Aс[1 + mₐ·m(t)]·cos(2πfсt)
```

Onde:
- mₐ: Índice de modulação (0 < mₐ ≤ 1 para evitar sobremodulação)
- m(t): Sinal normalizado (-1 ≤ m(t) ≤ 1)

#### 3.1.2 Interpretação Física

- O termo "1" representa a **portadora não suprimida**
- O termo mₐ·m(t) causa **variação na amplitude** da portadora
- Para mₐ = 1 e m(t) = -1, a amplitude vai a zero

**Espectro de Frequência:**

Para m(t) = cos(2πfₘt):
```
S(f) = (Aс/2)[δ(f-fс) + δ(f+fс)]           (portadora)
     + (Aс·mₐ/4)[δ(f-fс-fₘ) + δ(f-fс+fₘ)]  (banda lateral superior)
     + (Aс·mₐ/4)[δ(f+fс-fₘ) + δ(f+fс+fₘ)]  (banda lateral inferior)
```

**Largura de Banda:**
```
BW = 2·fₘₐₓ
```

#### 3.1.3 Implementação

**Modulação** (`modulation.service.ts`):
```typescript
modulateAM_DSB(message: SignalData, fc: number, ma: number, Ac: number = 1): Float64Array {
  const omegaC = 2 * Math.PI * fc;
  
  for (let i = 0; i < N; i++) {
    const t = message.x[i];
    const mt = message.y[i];
    // s(t) = Ac·[1 + ma·m(t)]·cos(ωc·t)
    out[i] = Ac * (1 + ma * mt) * Math.cos(omegaC * t);
  }
}
```

#### 3.1.4 Eficiência de Potência

A potência total transmitida é:

```
Pₜₒₜₐₗ = Pс + Pₛᵦ
```

Onde:
- Pс = Aс²/2 (potência da portadora)
- Pₛᵦ = (mₐ²·Aс²)/4 (potência nas bandas laterais)

**Eficiência:**
```
η = Pₛᵦ/Pₜₒₜₐₗ = mₐ²/(2 + mₐ²)
```

Para mₐ = 1: η = 33% (apenas 1/3 da potência carrega informação!)

### 3.2 AM-DSB-SC (Double Sideband Suppressed Carrier)

#### 3.2.1 Equação

```
s(t) = mₐ·m(t)·Aс·cos(2πfсt)
```

**Vantagem**: Elimina a portadora, aumentando eficiência para 100%

**Desvantagem**: Requer detecção coerente (sincronização de fase)

#### 3.2.2 Implementação

```typescript
modulateAM_DSB_SC(message: SignalData, fc: number, ma: number, Ac: number = 1): Float64Array {
  for (let i = 0; i < N; i++) {
    // Remove o termo "1 +" da equação AM-DSB
    out[i] = Ac * ma * mt * Math.cos(omegaC * t);
  }
}
```

#### 3.2.3 Espectro

Apenas as bandas laterais são transmitidas:
```
S(f) = (Aс·mₐ/4)[δ(f-fс-fₘ) + δ(f-fс+fₘ) + δ(f+fс-fₘ) + δ(f+fс+fₘ)]
```

**Largura de Banda:** Ainda BW = 2·fₘₐₓ

---

## 4. Modulação Angular: FM e PM

### 4.1 Conceitos Fundamentais

Nas modulações angulares, a **amplitude permanece constante** e o sinal de informação modifica o **argumento** da portadora.

#### 4.1.1 Forma Geral

```
s(t) = Aс·cos[2πfсt + φ(t)]
```

Onde φ(t) é a **fase instantânea** que varia com m(t).

### 4.2 Modulação em Frequência (FM)

#### 4.2.1 Princípio

A **frequência instantânea** é proporcional à mensagem:

```
fᵢ(t) = fс + kf·m(t)
```

Onde:
- kf: Constante de modulação FM (Hz/V)
- kf·m(t): Desvio de frequência

#### 4.2.2 Equação Matemática

Como f(t) = (1/2π)·dφ/dt, integrando:

```
s(t) = Aс·cos[2πfсt + 2π·kf·∫m(τ)dτ]
```

**Índice de Modulação FM:**
```
β = Δf/fₘ = kf·Aₘ/fₘ
```

Onde:
- Δf = kf·Aₘ: Desvio máximo de frequência
- fₘ: Frequência da mensagem

#### 4.2.3 Implementação

```typescript
modulateFM(m: SignalData, fc: number, fs: number, kf: number, Ac: number = 1): Float64Array {
  const omegaC = 2 * Math.PI * fc;
  const omega_kf = 2 * Math.PI * kf;
  
  let integral = 0;  // Acumulador para ∫m(t)dt
  
  for (let i = 0; i < N; i++) {
    // Aproximação da integral: Σm(t)·Δt = Σm(t)/fs
    integral += mt / fs;
    
    // s(t) = Ac·cos(2π·fc·t + 2π·kf·∫m(t)dt)
    const phase = omegaC * t + omega_kf * integral;
    out[i] = Ac * Math.cos(phase);
  }
}
```

**Nota importante:** A integração numérica usa o **método de Euler** (soma cumulativa).

#### 4.2.4 Largura de Banda (Regra de Carson)

```
BW ≈ 2(Δf + fₘₐₓ) = 2·fₘₐₓ(β + 1)
```

**Casos especiais:**
- β << 1 (banda estreita): BW ≈ 2fₘₐₓ (como AM)
- β >> 1 (banda larga): BW ≈ 2Δf

### 4.3 Modulação em Fase (PM)

#### 4.3.1 Princípio

A **fase instantânea** é diretamente proporcional à mensagem:

```
φ(t) = kp·m(t)
```

Onde kp é a constante de modulação PM (rad/V).

#### 4.3.2 Equação

```
s(t) = Aс·cos[2πfсt + kp·m(t)]
```

**Índice de Modulação PM:**
```
β = kp·Aₘ
```

#### 4.3.3 Implementação

```typescript
modulatePM(m: SignalData, fc: number, kp: number, Ac: number = 1): Float64Array {
  const omegaC = 2 * Math.PI * fc;
  
  for (let i = 0; i < N; i++) {
    // s(t) = Ac·cos(2π·fc·t + kp·m(t))
    out[i] = Ac * Math.cos(omegaC * t + kp * mt);
  }
}
```

#### 4.3.4 Relação entre FM e PM

**FM é a derivada de PM:**
```
s_FM(t) = cos[2πfсt + 2πkf·∫m(t)dt]
s_PM(t) = cos[2πfсt + kp·m(t)]
```

Se m_PM(t) = ∫m_FM(t)dt, então FM e PM são equivalentes.

### 4.4 Vantagens da Modulação Angular

1. **Imunidade a ruído**: Amplitude constante → menos sensível a ruído aditivo
2. **Melhor relação SNR**: Banda larga oferece troca de banda por SNR
3. **Captura**: Sinal mais forte "captura" o receptor (útil em broadcasting)

---

## 5. Single Sideband (SSB)

### 5.1 Motivação

AM-DSB transmite a mesma informação em **duas bandas laterais**:
- Banda lateral superior (USB): fс + fₘ
- Banda lateral inferior (LSB): fс - fₘ

**Problema:** Desperdício de banda e potência!

**Solução:** Transmitir apenas uma banda lateral (SSB).

### 5.2 Transformada de Hilbert

#### 5.2.1 Definição

A **transformada de Hilbert** H{m(t)} = m̂(t) é definida por:

```
m̂(t) = (1/π) ∫ m(τ)/(t-τ) dτ
```

**Propriedade fundamental:** Desloca a fase de todas as componentes em -90°.

No domínio da frequência:
```
M̂(f) = -j·sgn(f)·M(f)
```

Onde:
```
sgn(f) = { +1,  f > 0
         {  0,  f = 0
         { -1,  f < 0
```

#### 5.2.2 Implementação via FFT

```typescript
private hilbertTransform(signal: SignalData): Float64Array {
  // 1. Aplicar FFT
  const fft = this.fTService.fft(Array.from(padded));
  
  // 2. Criar filtro de Hilbert no domínio da frequência
  for (let k = 0; k < fftLen; k++) {
    if (k === 0 || k === fftLen / 2) {
      // DC e Nyquist: multiplicar por 0
      fft[k].re = 0;
      fft[k].im = 0;
    } else if (k < fftLen / 2) {
      // Frequências positivas: multiplicar por -j (rotação -90°)
      const temp = fft[k].re;
      fft[k].re = fft[k].im;   // -j·(a+jb) = b-ja
      fft[k].im = -temp;
    } else {
      // Frequências negativas: multiplicar por +j (rotação +90°)
      const temp = fft[k].re;
      fft[k].re = -fft[k].im;  // +j·(a+jb) = -b+ja
      fft[k].im = temp;
    }
  }
  
  // 3. IFFT para voltar ao domínio do tempo
  return this.fTService.ifft(fft);
}
```

### 5.3 Modulação SSB-USB

#### 5.3.1 Equação (Método de Hartley)

```
s(t) = mₐ·[m(t)·cos(2πfсt) - m̂(t)·sin(2πfсt)]
```

Onde:
- m(t)·cos(2πfсt): Componente em fase
- m̂(t)·sin(2πfсt): Componente em quadratura

**Espectro:** Apenas componentes em f > fс (banda superior)

#### 5.3.2 Implementação

```typescript
modulateAM_SSB_USB(message: SignalData, fc: number, ma: number, Ac: number = 1): Float64Array {
  // 1. Calcular transformada de Hilbert
  const hilbert = this.hilbertTransform(message);
  
  // 2. Gerar SSB-USB
  for (let i = 0; i < N; i++) {
    const mt = message.y[i];
    const mht = hilbert[i];
    
    // s(t) = Ac·ma·[m(t)·cos(ωc·t) - m̂(t)·sin(ωc·t)]
    out[i] = Ac * ma * (mt * Math.cos(omegaC * t) - mht * Math.sin(omegaC * t));
  }
}
```

### 5.4 Vantagens do SSB

1. **Economia de banda:** BW = fₘₐₓ (metade do AM-DSB)
2. **Economia de potência:** Toda potência na banda útil
3. **Menos interferência:** Ocupa menos espectro

**Aplicações:** Rádio amador, comunicação militar, telefonia de longa distância

---

## 6. Demodulação de Sinais

### 6.1 Detector de Envelope (AM-DSB)

#### 6.1.1 Princípio

O **detector de envelope** recupera a mensagem extraindo a "envoltória" do sinal modulado.

**Método clássico:** Retificador + filtro passa-baixas

**Método digital:** Transformada de Hilbert

#### 6.1.2 Cálculo do Envelope

Dado s(t), seu envelope é:

```
E(t) = |s(t) + j·ŝ(t)| = √[s²(t) + ŝ²(t)]
```

Onde ŝ(t) = H{s(t)} é a transformada de Hilbert.

**Recuperação da mensagem:**
```
m(t) = [E(t) - 1]/mₐ
```

#### 6.1.3 Implementação

```typescript
demodulateAM_DSB(modulated: SignalData, fc: number, ma: number): Float64Array {
  // 1. Calcular envelope usando Hilbert
  const envelope = this.envelopeDetector(modulated);
  
  // 2. Remover DC e normalizar
  for (let i = 0; i < N; i++) {
    out[i] = (envelope[i] - 1) / ma;
  }
}

private envelopeDetector(signal: SignalData): Float64Array {
  const hilbert = this.hilbertTransform(signal);
  
  for (let i = 0; i < N; i++) {
    // |s + j·ŝ| = √(s² + ŝ²)
    out[i] = Math.sqrt(signal.y[i] ** 2 + hilbert[i] ** 2);
  }
}
```

### 6.2 Detecção Coerente (AM-DSB-SC e SSB)

#### 6.2.1 Princípio

Multiplica o sinal recebido por uma **réplica síncrona** da portadora:

```
r(t) = s(t)·cos(2πfсt + θ)
```

Para AM-DSB-SC:
```
s(t) = mₐ·m(t)·cos(2πfсt)

r(t) = mₐ·m(t)·cos(2πfсt)·cos(2πfсt + θ)
     = (mₐ/2)·m(t)·[cos(θ) + cos(4πfсt + θ)]
```

Após filtro passa-baixas (remove 4πfс):
```
m(t) ≈ (mₐ/2)·m(t)·cos(θ)
```

**Requisito crítico:** θ ≈ 0 (sincronização de fase perfeita)

#### 6.2.2 Implementação

```typescript
demodulateAM_DSB_SC(modulated: SignalData, fc: number, ma: number): Float64Array {
  const omegaC = 2 * Math.PI * fc;
  
  for (let i = 0; i < N; i++) {
    // Multiplicação pela portadora local
    out[i] = modulated.y[i] * Math.cos(omegaC * t) * 2 / ma;
  }
  
  // Nota: Filtro passa-baixas deve ser aplicado externamente
  return out;
}
```

### 6.3 Discriminador de Frequência (FM)

#### 6.3.1 Princípio

A demodulação FM recupera m(t) a partir da **frequência instantânea**:

```
fᵢ(t) = fс + kf·m(t)

⟹ m(t) = [fᵢ(t) - fс]/kf
```

#### 6.3.2 Cálculo da Frequência Instantânea

A frequência instantânea é a **derivada da fase**:

```
fᵢ(t) = (1/2π)·dφ(t)/dt
```

**Algoritmo:**
1. Extrair fase instantânea φ(t) usando Hilbert
2. Aplicar unwrap para remover descontinuidades de 2π
3. Calcular derivada numérica
4. Remover fс e escalar por 1/kf

#### 6.3.3 Extração de Fase

```typescript
// Formar sinal analítico: z(t) = s(t) + j·ŝ(t)
const hilbert = this.hilbertTransform(modulated);

// Fase instantânea: φ(t) = arctan[ŝ(t)/s(t)]
for (let i = 0; i < N; i++) {
  instantaneousPhase[i] = Math.atan2(hilbert[i], modulated.y[i]);
}
```

#### 6.3.4 Phase Unwrapping

Remove saltos de ±2π na fase:

```typescript
private unwrapPhase(phase: Float64Array): void {
  const threshold = Math.PI;
  
  for (let i = 1; i < phase.length; i++) {
    const diff = phase[i] - phase[i - 1];
    
    // Se salto > π, subtrair 2π
    if (diff > threshold) {
      for (let j = i; j < phase.length; j++) {
        phase[j] -= 2 * Math.PI;
      }
    }
    // Se salto < -π, adicionar 2π
    else if (diff < -threshold) {
      for (let j = i; j < phase.length; j++) {
        phase[j] += 2 * Math.PI;
      }
    }
  }
}
```

#### 6.3.5 Derivação Numérica

```typescript
// Aproximação por diferenças finitas
for (let i = 0; i < N; i++) {
  if (i === 0) {
    // Forward difference
    instantaneousFreq[i] = (phase[i + 1] - phase[i]) * fs / (2 * Math.PI);
  } else if (i === N - 1) {
    // Backward difference
    instantaneousFreq[i] = (phase[i] - phase[i - 1]) * fs / (2 * Math.PI);
  } else {
    // Central difference (mais precisa)
    instantaneousFreq[i] = (phase[i + 1] - phase[i - 1]) * fs / (4 * Math.PI);
  }
}
```

#### 6.3.6 Recuperação da Mensagem

```typescript
for (let i = 0; i < N; i++) {
  // m(t) = [f_inst(t) - fc] / kf
  demodulated[i] = (instantaneousFreq[i] - fc) / kf;
}

// Remover DC residual
const mean = demodulated.reduce((sum, val) => sum + val, 0) / N;
for (let i = 0; i < N; i++) {
  out[i] = demodulated[i] - mean;
}
```

### 6.4 Discriminador de Fase (PM)

#### 6.4.1 Diferença em relação ao FM

Para PM, a mensagem está diretamente na fase:

```
φ(t) = 2πfсt + kp·m(t)

⟹ m(t) = [φ(t) - 2πfсt]/kp
```

**Não precisa derivar!** Apenas remover a componente da portadora.

#### 6.4.2 Implementação

```typescript
demodulatePM(modulated: SignalData, fc: number, fs: number, kp: number): Float64Array {
  // 1. Extrair fase instantânea
  const hilbert = this.hilbertTransform(modulated);
  for (let i = 0; i < N; i++) {
    instantaneousPhase[i] = Math.atan2(hilbert[i], modulated.y[i]);
  }
  
  // 2. Unwrap
  this.unwrapPhase(instantaneousPhase);
  
  // 3. Remover portadora e escalar
  const omegaC = 2 * Math.PI * fc;
  for (let i = 0; i < N; i++) {
    demodulated[i] = (instantaneousPhase[i] - omegaC * t) / kp;
  }
  
  // 4. Remover DC
  const mean = demodulated.reduce((sum, val) => sum + val, 0) / N;
  for (let i = 0; i < N; i++) {
    out[i] = demodulated[i] - mean;
  }
}
```

---

## 7. Multiplexação por Divisão de Frequência

### 7.1 Conceito

**FDM (Frequency Division Multiplexing)** permite transmitir múltiplos sinais simultaneamente no mesmo canal físico, alocando cada sinal em uma **banda de frequência diferente**.

### 7.2 Princípio de Operação

Considere N sinais mᵢ(t) com largura de banda B:

```
┌─────────┬─────────┬─────────┬─────────┐
│ Canal 1 │ Canal 2 │ Canal 3 │ Canal 4 │
│ fc₁±B   │ fc₂±B   │ fc₃±B   │ fc₄±B   │
└─────────┴─────────┴─────────┴─────────┘
    f₁        f₂        f₃        f₄
```

**Condições:**
1. Bandas não devem se sobrepor: fcᵢ₊₁ - fcᵢ > 2B
2. Cada sinal usa portadora diferente
3. Banda de guarda entre canais para evitar interferência

### 7.3 Implementação no Sistema

#### 7.3.1 Validação de Sinais

```typescript
validateSignals(signals: SignalOutput[]): SignalValidationInfo[] {
  return signals.map(signal => {
    // Extrai parâmetros de cada sinal
    const numSamples = signal.data.x.length;
    const duration = signal.data.x[numSamples - 1] - signal.data.x[0];
    
    // Calcula fs a partir do espaçamento temporal
    const samplingFrequency = Math.round(1 / (signal.data.x[1] - signal.data.x[0]));
    
    return { transmitterId, samplingFrequency, duration, numSamples, hasSignal };
  });
}
```

#### 7.3.2 Verificação de Consistência

**Requisito:** Todos os sinais devem ter a mesma fs!

```typescript
checkSamplingFrequencyConsistency(validationInfos): {
  const maxFs = Math.max(...frequencies);
  const tolerance = 0.01; // 1% de tolerância
  
  const inconsistent = validationInfos.filter(
    info => Math.abs(info.samplingFrequency - maxFs) / maxFs > tolerance
  );
  
  return {
    isConsistent: inconsistent.length === 0,
    maxFs,
    inconsistentTransmitters
  };
}
```

#### 7.3.3 Multiplexação (Soma no Tempo)

```typescript
multiplexSignals(signals: SignalOutput[], targetDuration: number, fs: number): SignalData {
  const targetSamples = Math.round(targetDuration * fs);
  
  // Inicializa com zeros
  const y = new Float64Array(targetSamples);
  
  // Soma todos os sinais ponto a ponto
  for (const signal of signals) {
    for (let i = 0; i < Math.min(signal.data.y.length, targetSamples); i++) {
      y[i] += signal.data.y[i];  // FDM = soma no domínio do tempo
    }
  }
  
  return { x, y };
}
```

**Nota importante:** A soma no **domínio do tempo** corresponde à justaposição no **domínio da frequência** (linearidade da Transformada de Fourier).

### 7.4 Exemplo Prático

**Cenário:** 3 transmissores com sinais de voz (B = 4 kHz)

```
Transmissor 1: fc₁ = 10 kHz  →  Banda: 6-14 kHz
Transmissor 2: fc₂ = 20 kHz  →  Banda: 16-24 kHz
Transmissor 3: fc₃ = 30 kHz  →  Banda: 26-34 kHz

Banda total do canal: 6-34 kHz (28 kHz)
```

**Taxa de amostragem necessária:**
```
fs ≥ 2·34 kHz = 68 kHz
```

### 7.5 Demultiplexação

No receptor, cada sinal é recuperado por:

1. **Filtragem passa-faixa** centrada em fcᵢ
2. **Demodulação** com portadora local em fcᵢ
3. **Filtragem passa-baixas** para recuperar m(t)

**No sistema:** O receptor permite selecionar qual transmissor/canal conectar, e aplica os filtros e demodulação apropriados.

---

## 8. Filtragem Digital

### 8.1 Filtros FIR

#### 8.1.1 Definição

**FIR (Finite Impulse Response):** Filtro cuja resposta ao impulso tem duração finita.

```
y[n] = Σ(k=0 to N-1) h[k]·x[n-k]
```

Onde:
- h[k]: Coeficientes do filtro (resposta ao impulso)
- N: Ordem do filtro

**Vantagens:**
- **Fase linear**: Não distorce a forma do sinal
- **Sempre estável**: Não tem pólos
- **Fácil implementação**

#### 8.1.2 Projeto de Filtro Passa-Faixa

Método utilizado: **Janelamento com Hamming**

**Passos:**
1. Projetar dois filtros passa-baixas: h_LP(fc1) e h_LP(fc2)
2. Subtrair: h_BP = h_LP(fc2) - h_LP(fc1)
3. Aplicar janela de Hamming para reduzir lóbulos laterais

#### 8.1.3 Sinc e Passa-Baixas Ideal

O filtro passa-baixas ideal no domínio do tempo é:

```
h_LP[n] = 2·fc·sinc(2·fc·n)
```

Onde:
```
sinc(x) = sin(πx)/(πx)
```

**Implementação:**
```typescript
private sinc(x: number): number {
  if (Math.abs(x) < 1e-12) return 1;  // sinc(0) = 1
  const pix = Math.PI * x;
  return Math.sin(pix) / pix;
}
```

#### 8.1.4 Janela de Hamming

```
w[n] = 0.54 - 0.46·cos(2πn/(N-1))
```

**Propósito:** Reduzir ripple na banda passante e aumentar atenuação na banda de rejeição.

```typescript
// Janela de Hamming
for (let n = 0; n < N; n++) {
  w[n] = 0.54 - 0.46 * Math.cos(2 * Math.PI * n / (N - 1));
}
```

#### 8.1.5 Filtro Passa-Faixa Completo

```typescript
designBandPassFir(order: number, fs: number, fLow: number, fHigh: number): Float64Array {
  const N = order;
  const M = (N - 1) / 2;  // Centro do filtro
  
  // Frequências normalizadas
  const fc1 = fLow / fs;
  const fc2 = fHigh / fs;
  
  const h = new Float64Array(N);
  const w = new Float64Array(N);
  
  // Janela de Hamming
  for (let n = 0; n < N; n++) {
    w[n] = 0.54 - 0.46 * Math.cos(2 * Math.PI * n / (N - 1));
  }
  
  // h_BP = h_LP(fc2) - h_LP(fc1)
  for (let n = 0; n < N; n++) {
    const k = n - M;
    const h_lp1 = 2 * fc1 * this.sinc(2 * fc1 * k);
    const h_lp2 = 2 * fc2 * this.sinc(2 * fc2 * k);
    h[n] = (h_lp2 - h_lp1) * w[n];
  }
  
  // Normalização do ganho
  const f0 = (fLow + fHigh) / 2;
  const omega0 = 2 * Math.PI * (f0 / fs);
  
  let Re = 0, Im = 0;
  for (let n = 0; n < N; n++) {
    const theta = -omega0 * (n - M);
    Re += h[n] * Math.cos(theta);
    Im += h[n] * Math.sin(theta);
  }
  
  const mag = Math.hypot(Re, Im);
  if (mag > 0) {
    for (let n = 0; n < N; n++) h[n] /= mag;  // Ganho unitário
  }
  
  return h;
}
```

### 8.2 Convolução

#### 8.2.1 Definição

A **convolução** é a operação que aplica o filtro ao sinal:

```
y[n] = (x ⊛ h)[n] = Σ(k=0 to M-1) x[n-k]·h[k]
```

#### 8.2.2 Modo "Same"

Retorna saída com **mesmo tamanho** que a entrada:

```typescript
private convolveSame(x: Float64Array, h: Float64Array): Float64Array {
  const N = x.length;
  const M = h.length;
  const out = new Float64Array(N);
  const half = Math.floor(M / 2);
  
  for (let n = 0; n < N; n++) {
    let acc = 0;
    for (let k = 0; k < M; k++) {
      const idx = n + k - half;  // Centraliza o filtro
      if (idx >= 0 && idx < N) {
        acc += x[idx] * h[k];
      }
    }
    out[n] = acc;
  }
  
  return out;
}
```

### 8.3 Resposta em Frequência

#### 8.3.1 DTFT do Filtro

A **resposta em frequência** H(f) mostra o ganho do filtro em cada frequência:

```
H(f) = Σ(n=0 to N-1) h[n]·e^(-j2πfn/fs)
```

**Magnitude:** |H(f)| = √[Re²(f) + Im²(f)]

#### 8.3.2 Cálculo no Código

```typescript
computeFrequencyResponse(h: Float64Array, fs: number, maxFreq: number): SignalData {
  const N = h.length;
  const M = Math.floor((N - 1) / 2);
  const numPoints = 512;
  
  const x = new Float64Array(numPoints);
  const y = new Float64Array(numPoints);
  
  for (let i = 0; i < numPoints; i++) {
    const freq = (maxFreq * i) / (numPoints - 1);
    const omega = 2 * Math.PI * (freq / fs);
    
    // DTFT: H(ω) = Σ h[n]·e^(-jωn)
    let Re = 0, Im = 0;
    for (let n = 0; n < N; n++) {
      const theta = -omega * (n - M);
      Re += h[n] * Math.cos(theta);
      Im += h[n] * Math.sin(theta);
    }
    
    x[i] = freq;
    y[i] = Math.hypot(Re, Im);  // |H(f)|
  }
  
  return { x, y };
}
```

---

## 9. Guia Prático do Sistema

### 9.1 Criando um Transmissor

1. **Navegue para "Transmissores"**
2. **Clique em "Novo Transmissor"**
3. **Configure o sinal de banda base:**
   - Tipo: Senoidal, triangular, quadrada
   - Amplitude (A)
   - Frequência (fm)
   - Fase (φ)
   - Offset DC

4. **Defina parâmetros de amostragem:**
   - Duração (ms)
   - Frequência de amostragem (fs)
   - **Atenção:** fs ≥ 2(fc + fm) para evitar aliasing

5. **Configure a modulação:**
   - Tipo: AM-DSB, AM-DSB-SC, FM, PM, SSB-USB
   - Frequência da portadora (fc)
   - Amplitude da portadora (Ac)
   - Índice de modulação (ma, kf, kp)

6. **(Opcional) Aplique filtro pré-modulação:**
   - Limite inferior (Hz)
   - Limite superior (Hz)
   - Ordem do filtro

7. **Visualize:**
   - Sinal de banda base m(t)
   - Sinal modulado s(t)
   - Espectro de frequência |S(f)|

8. **Clique em "Transmitir"** para salvar no Firestore

### 9.2 Criando um Canal (Multiplexador)

1. **Navegue para "Canais"**
2. **Clique em "Novo Canal"**
3. **Selecione transmissores:**
   - Marque os transmissores desejados
   - Sistema valida se fs são compatíveis

4. **Configure o canal:**
   - Duração (s): ajustada automaticamente
   - fs: usa o máximo dos transmissores

5. **(Opcional) Aplique filtro ao sinal multiplexado:**
   - Útil para simular banda limitada do canal
   - Configure fLow, fHigh, ordem

6. **Visualize:**
   - Sinal multiplexado (soma)
   - Espectro mostrando todas as portadoras
   - Resposta em frequência do filtro

7. **Clique em "Transmitir"** para disponibilizar ao receptor

### 9.3 Recebendo e Demodulando

1. **Navegue para "Receptor"**
2. **Escaneie QR Code** ou use URL com `?tx=ID` ou `?channel=ID`
3. **O sistema carrega automaticamente o sinal**
4. **Configure a duração de análise:**
   - Permite processar apenas parte do sinal

5. **(Opcional) Filtro pré-demodulação:**
   - Isola a banda de interesse
   - Útil em FDM para selecionar um canal

6. **Configure a demodulação:**
   - Tipo: Deve corresponder à modulação usada
   - fc: Frequência da portadora (deve ser exata!)
   - fs: Inferida automaticamente
   - Constante: ma, kf, ou kp

7. **(Opcional) Filtro pós-demodulação:**
   - Remove componentes de alta frequência
   - Essencial para detecção coerente

8. **Visualize:**
   - Sinal modulado recebido
   - Sinal demodulado (recuperação de m(t))
   - Compare com sinal original!

### 9.4 Conectividade via QR Code

O sistema gera QR Codes contendo URLs:

```
https://signalsim-1135b.firebaseapp.com/receiver?tx=<ID>
https://signalsim-1135b.firebaseapp.com/receiver?channel=<ID>
```

**Vantagens:**
- Compartilhamento fácil entre dispositivos
- Demonstrações em sala de aula
- Múltiplos receptores para o mesmo transmissor

---

## 10. Experimentos Sugeridos

### 10.1 Experimento 1: Efeito do Índice de Modulação AM

**Objetivo:** Observar sobremodulação e distorção.

**Procedimento:**
1. Crie transmissor com sinal senoidal (fm = 1 kHz)
2. Configure AM-DSB com fc = 10 kHz
3. Varie ma: 0.3, 0.5, 0.8, 1.0, 1.5
4. Observe o sinal modulado e o espectro

**Questões:**
- O que acontece quando ma > 1?
- Como o espectro muda?
- Qual o efeito na demodulação com detector de envelope?

### 10.2 Experimento 2: Comparação FM vs PM

**Objetivo:** Entender a diferença entre FM e PM.

**Procedimento:**
1. Crie dois transmissores idênticos (fm = 500 Hz)
2. Transmissor 1: FM com kf = 1000 Hz
3. Transmissor 2: PM com kp = 5 rad
4. Compare sinais modulados e espectros

**Questões:**
- Como os espectros diferem?
- Qual ocupa mais banda?
- Como a demodulação difere?

### 10.3 Experimento 3: FDM com 3 Canais

**Objetivo:** Implementar um sistema FDM completo.

**Procedimento:**
1. Crie 3 transmissores:
   - TX1: AM-DSB, fc1 = 10 kHz, ma = 0.8
   - TX2: AM-DSB, fc2 = 20 kHz, ma = 0.8
   - TX3: AM-DSB, fc3 = 30 kHz, ma = 0.8
2. Crie canal multiplexador selecionando os 3
3. Observe espectro do sinal multiplexado
4. No receptor, aplique filtro pré-demodulação:
   - Para TX1: 6-14 kHz
   - Para TX2: 16-24 kHz
   - Para TX3: 26-34 kHz
5. Demodule e compare com sinais originais

**Questões:**
- Os sinais foram recuperados corretamente?
- O que acontece se as bandas se sobrepuserem?
- Qual a eficiência espectral do sistema?

### 10.4 Experimento 4: Efeito da Ordem do Filtro

**Objetivo:** Entender a relação ordem-seletividade.

**Procedimento:**
1. Crie transmissor FM (kf = 2000, β ≈ 4)
2. No receptor, aplique filtro pós-demodulação:
   - Teste ordens: 11, 51, 101, 201
   - fLow = 0, fHigh = fm
3. Compare resposta em frequência e sinal filtrado

**Questões:**
- Como a ordem afeta a nitidez da banda de transição?
- Há atraso no sinal com ordem maior?
- Qual a ordem mínima aceitável?

### 10.5 Experimento 5: SSB vs DSB

**Objetivo:** Comparar eficiência espectral.

**Procedimento:**
1. Crie dois transmissores com mesmo m(t):
   - TX1: AM-DSB-SC
   - TX2: AM-SSB-USB
2. Compare espectros (mesmo fc, mesmo ma)
3. Calcule largura de banda ocupada
4. Teste demodulação coerente em ambos

**Questões:**
- SSB ocupa metade da banda?
- A qualidade de demodulação é semelhante?
- Quando SSB é preferível?

### 10.6 Experimento 6: Validação do Teorema de Nyquist

**Objetivo:** Observar aliasing.

**Procedimento:**
1. Crie sinal com fm = 2 kHz
2. Module em fc = 10 kHz (AM-DSB)
3. Varie fs: 25 kHz, 20 kHz, 15 kHz
4. Observe espectro e sinal demodulado

**Questões:**
- Com qual fs aparece aliasing?
- Como o espectro indica subamostragem?
- O sinal demodulado é correto?

### 10.7 Experimento 7: Detecção Coerente com Erro de Fase

**Objetivo:** Investigar sensibilidade à sincronização.

**Procedimento:**
1. Transmita AM-DSB-SC
2. No receptor, demodule com detecção coerente
3. (Modificação manual no código) Introduza erro de fase θ
4. Observe atenuação: m̂(t) = m(t)·cos(θ)

**Questões:**
- Qual erro de fase causa atenuação de 50%? (θ = 60°)
- Por que θ = 90° resulta em sinal nulo?
- Como recuperar sincronização em sistema real? (PLL)

---

## Conclusão

Este documento apresentou os fundamentos matemáticos e práticos dos **sistemas de comunicação analógica**, cobrindo:

✅ **Modulação AM** (DSB, DSB-SC, SSB) com detector de envelope e coerente  
✅ **Modulação Angular** (FM e PM) com discriminadores  
✅ **Multiplexação FDM** para transmissão multicanal  
✅ **Filtragem FIR** com projeto e análise de resposta  
✅ **Implementação prática** no sistema SignalSim  

O **SignalSim** serve como laboratório virtual onde conceitos teóricos ganham vida através de visualizações interativas. Ao experimentar com diferentes configurações, o estudante desenvolve intuição sobre:

- Trade-offs entre largura de banda e potência
- Efeitos de não-linearidades e distorções
- Importância da sincronização em sistemas coerentes
- Desafios práticos de projeto de filtros

**Próximos Passos:**

1. Realize os experimentos sugeridos
2. Modifique parâmetros e observe resultados
3. Compare sinais transmitidos e recebidos
4. Documente observações e tire conclusões

**Referências Adicionais:**

📚 *Communication Systems* - Simon Haykin  
📚 *Principles of Communication Systems* - Taub & Schilling  
📚 *Digital Signal Processing* - Proakis & Manolakis  

---

*Desenvolvido como material didático para disciplinas de Telecomunicações e Processamento de Sinais.*

**Versão:** 1.0 | **Data:** Dezembro 2025

