import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  doc,
  collection,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
  DocumentData,
} from '@angular/fire/firestore';

import { SignalOutput } from '../interfaces/signal-output';
import { TransmitterConfig } from '../interfaces/transmitter-config';
import { ChannelConfig, ChannelOutput } from '../interfaces/channel';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class FirestoreService {
  // Firebase collection paths
  private signalsPath = 'signals';
  private transmittersPath = 'transmitters';
  private channelsPath = 'channels';

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

  subscribeToSignal(id: string): Observable<DocumentData | undefined> {
    return new Observable((observer) => {
      const unsubscribe = onSnapshot(doc(this.db, "signals", id), (doc) => {
        observer.next(doc.data());
      });

      // Cleanup subscription on unsubscription
      return () => {
        unsubscribe();
      };
    });
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

  // ==================== CHANNEL METHODS ====================

  /**
   * Salva a configuração e dados do canal no Firestore
   * @param channelConfig Configuração do canal
   * @param channelOutput Dados de saída do canal
   * @param id ID do canal (opcional)
   * @returns Promise<string> ID do canal
   */
  async saveChannel(channelConfig: ChannelConfig, channelOutput: ChannelOutput, id?: string): Promise<string> {
    try {
      const channelsRef = collection(this.db, this.channelsPath);

      const channelData = {
        config: channelConfig,
        data: channelOutput.data
      };
      
      // Se config.filter for undefined, remove a propriedade
      if (channelConfig.filter === undefined) {
        delete channelData.config.filter;
      }
      // Atualiza documento existente
      if (id) {
        await setDoc(doc(channelsRef, id), channelData);
        return id;
      }

      const newChannel = doc(channelsRef);
      await setDoc(newChannel, channelData);
      return newChannel.id;
    } catch (error: unknown) {
      const err: any = new Error('Error saving channel');
      err.cause = error;
      throw err;
    }
  }

  /**
   * Obtém a configuração e dados do canal pelo ID
   * @param id ID do canal
   * @returns Configuração e dados do canal ou null se não encontrado
   */
  async getChannelById(id: string): Promise<{ config: ChannelConfig; data: { x: number[]; y: number[] } } | null> {
    try {
      const channelRef = doc(this.db, this.channelsPath, id);
      const channelSnap = await getDoc(channelRef);

      if (!channelSnap.exists()) {
        return null;
      }

      return channelSnap.data() as { config: ChannelConfig; data: { x: number[]; y: number[] } };
    } catch (error: unknown) {
      const err: any = new Error('Error getting channel by ID');
      err.cause = error;
      throw err;
    }
  }

  /**
   * Obtém todos os canais salvos no Firestore
   * @returns Lista de canais com suas configurações
   */
  async getAllChannels(): Promise<Array<{ id: string; config: ChannelConfig; data: { x: number[]; y: number[] } }>> {
    try {
      const channelsRef = collection(this.db, this.channelsPath);
      const channelsSnap = await getDocs(channelsRef);

      const channels: Array<{ id: string; config: ChannelConfig; data: { x: number[]; y: number[] } }> = [];
      channelsSnap.forEach((docSnap) => {
        const data = docSnap.data() as { config: ChannelConfig; data: { x: number[]; y: number[] } };
        channels.push({ id: docSnap.id, ...data });
      });

      return channels;
    } catch (error: unknown) {
      const err: any = new Error('Error getting all channels');
      err.cause = error;
      throw err;
    }
  }

  /**
   * Deleta um canal pelo ID
   * @param id ID do canal
   */
  async deleteChannel(id: string): Promise<void> {
    try {
      const channelRef = doc(this.db, this.channelsPath, id);
      await deleteDoc(channelRef);
    } catch (error: unknown) {
      const err: any = new Error(`Error deleting channel <${id}>`);
      err.cause = error;
      throw err;
    }
  }

  /**
   * Subscreve às mudanças de um canal específico
   * @param id ID do canal
   * @returns Observable com dados do canal
   */
  subscribeToChannel(id: string): Observable<DocumentData | undefined> {
    return new Observable((observer) => {
      const unsubscribe = onSnapshot(doc(this.db, this.channelsPath, id), (doc) => {
        observer.next(doc.data());
      });

      return () => {
        unsubscribe();
      };
    });
  }
}
