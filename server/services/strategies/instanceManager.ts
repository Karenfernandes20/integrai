
import { EvolutionStrategy } from './evolution.strategy.js';
import { LocalStrategy } from './local.strategy.js';
import { OfficialStrategy } from './official.strategy.js';
import { InstanceStrategy } from './instance.strategy.js';

export class InstanceManager {
    static getStrategy(type: string): InstanceStrategy {
        switch (type.toLowerCase()) {
            case 'evolution':
                return new EvolutionStrategy();
            case 'local':
                return new LocalStrategy();
            case 'official':
            case 'whatsapp_official':
                return new OfficialStrategy();
            default:
                throw new Error(`Unknown instance type: ${type}`);
        }
    }

    static async createInstance(type: string, instanceId: string, companyId: number, io: any, apiKey?: string) {
        return this.getStrategy(type).createInstance(instanceId, companyId, io, apiKey);
    }

    static async connectInstance(type: string, instanceId: string, companyId: number, io: any, apiKey?: string) {
        return this.getStrategy(type).connectInstance(instanceId, companyId, io, apiKey);
    }

    static async disconnectInstance(type: string, instanceId: string) {
        return this.getStrategy(type).disconnectInstance(instanceId);
    }

    static async deleteInstance(type: string, instanceId: string) {
        return this.getStrategy(type).deleteInstance(instanceId);
    }

    static async getQRCode(type: string, instanceId: string) {
        return this.getStrategy(type).getQRCode(instanceId);
    }

    static async getStatus(type: string, instanceId: string) {
        return this.getStrategy(type).getStatus(instanceId);
    }
}
