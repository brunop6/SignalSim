import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  doc,
  collection,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc
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

  private db = inject(Firestore);

  constructor() { }

  /**
   * Salva a configuração do transmissor no Firestore
   * @param transmitterConfig Configuração completa do transmissor
   * @param id ID do transmissor (opcional)
   * @returns Promise<void>
   */
  async saveTransmitter(transmitterConfig: TransmitterConfig, id?: string): Promise<string> {
    try {
      const txRef = collection(this.db, this.transmittersPath);

      // Atualiza documento existente
      if (id) {
        await setDoc(doc(txRef, id), transmitterConfig);
        return id;
      }

      const newTx = doc(txRef);
      await setDoc(newTx, transmitterConfig);
      return newTx.id;
    } catch (error: unknown) {
      const err: any = new Error('Error saving transmitter configuration');
      err.cause = error;
      throw err;
    }
  }

  /**
   * Salva a saída de sinal no Firestore
   * @param signalOutput Dados da saída de sinal
   */
  async saveSignalOutput(signalOutput: SignalOutput): Promise<void> {
    try {
      if (!signalOutput?.transmitterId) {
        throw new Error('transmitterId is required to save signal output');
      }
      const signalsRef = collection(this.db, this.signalsPath);
      await setDoc(doc(signalsRef, signalOutput.transmitterId), signalOutput);
    } catch (error: unknown) {
      const err: any = new Error('Error saving signal output');
      err.cause = error;
      throw err;
    }
  }

  /**
   * Obtém a configuração do transmissor pelo ID
   * @param id ID do transmissor
   * @returns Configuração do transmissor ou null se não encontrado
   */
  async getTransmitterById(id: string): Promise<TransmitterConfig | null> {
    try {
      const txRef = doc(this.db, this.transmittersPath, id);
      const txSnap = await getDoc(txRef);

      if (!txSnap.exists()) {
        return null;
      }

      return txSnap.data() as TransmitterConfig;
    } catch (error: unknown) {
      const err: any = new Error('Error getting transmitter by ID');
      err.cause = error;
      throw err;
    }
  }

  /**
   * Obtém todos os transmissores salvos no Firestore
   * @returns Lista de configurações de transmissores
   */
  async getAllTransmitters(): Promise<Array<TransmitterConfig & { id: string }>> {
    try {
      const txRef = collection(this.db, this.transmittersPath);
      const txSnap = await getDocs(txRef);

      const transmitters: Array<TransmitterConfig & { id: string }> = [];
      txSnap.forEach((docSnap) => {
        const data = docSnap.data() as TransmitterConfig;
        transmitters.push({ id: docSnap.id, ...data });
      });

      return transmitters;
    } catch (error: unknown) {
      const err: any = new Error('Error getting all transmitters');
      err.cause = error;
      throw err;
    }
  }

  /**
   * Deleta um transmissor e seu respectivo sinal pelo ID
   * @param id ID do transmissor
   */
  async deleteTransmitter(id: string): Promise<void> {
    const txRef = doc(this.db, this.transmittersPath, id);
    const signalRef = doc(this.db, this.signalsPath, id);
    const errors: Error[] = [];

    try {
      await deleteDoc(signalRef);
    } catch (error: unknown) {
      const err: any = new Error(`Error deleting signal document for transmitter <${id}>`);
      err.cause = error;
      errors.push(err);
    }

    try {
      await deleteDoc(txRef);
    } catch (error: unknown) {
      const err: any = new Error(`Error deleting transmitter document <${id}>`);
      err.cause = error;
      errors.push(err);
    }

    if (errors.length) {
      // Rejeita com o primeiro erro para manter compatibilidade, preservando causa
      throw errors[0];
    }
  }
}
