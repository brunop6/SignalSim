import { Injectable } from '@angular/core';
import {
  Firestore,
  getFirestore,
  doc,
  collection,
  setDoc,
  getDoc
} from '@angular/fire/firestore';

import { SignalOutput } from '../interfaces/signal-output';
import { TransmitterConfig } from '../interfaces/transmitter-config';

@Injectable({
  providedIn: 'root'
})
export class FirestoreService {
  // Firebase collection paths
  private signalsPath = 'signals';
  private transmittersPath = 'transmitters';

  constructor(
    private db: Firestore = getFirestore()
  ) { };

  /**
   * Salva a configuração do transmissor no Firestore
   * @param transmitterConfig Configuração completa do transmissor
   * @param id ID do transmissor (opcional)
   * @returns Promise<void>
   */
  async saveTransmitter(transmitterConfig: TransmitterConfig, id?: string): Promise<void> {
    const transmittersRef = collection(this.db, this.transmittersPath);

    // Atualiza documento existente
    if (id) {
      return await setDoc(doc(transmittersRef, id), transmitterConfig);
    }

    // Cria novo documento
    return await setDoc(doc(transmittersRef), transmitterConfig);
  }

  /**
   * Salva a saída de sinal no Firestore
   * @param signalOutput Dados da saída de sinal
   */
  async saveSignalOutput(signalOutput: SignalOutput): Promise<void> {
    const signalsRef = collection(this.db, this.signalsPath);

    await setDoc(doc(signalsRef, signalOutput.transmitterId), signalOutput);
  }

  async getTransmitterById(id: string): Promise<TransmitterConfig | null> {
    const txRef = doc(this.db, this.transmittersPath, id);
    const txSnap = await getDoc(txRef);

    if (!txSnap.exists()) {
      return null;
    }

    return txSnap.data() as TransmitterConfig;
  }
}
