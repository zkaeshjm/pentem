type ServiceFactory<T> = (container: Container) => T;

export class Container {
  private readonly factories = new Map<string, ServiceFactory<unknown>>();
  private readonly instances = new Map<string, unknown>();

  register<T>(name: string, factory: ServiceFactory<T>): void {
    this.factories.set(name, factory as ServiceFactory<unknown>);
  }

  resolve<T>(name: string): T {
    const existing = this.instances.get(name);
    if (existing) return existing as T;

    const factory = this.factories.get(name);
    if (!factory) throw new Error(`Service not registered: ${name}`);

    const instance = factory(this);
    this.instances.set(name, instance);
    return instance as T;
  }

  has(name: string): boolean {
    return this.factories.has(name);
  }
}
