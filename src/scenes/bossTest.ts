import { AiTest, aiTestSchema } from './aiTest';
import data from '../data/scenes/bossTest.json';

export class BossTest extends AiTest {
  constructor(loadModels = true) {
    super(loadModels, { id: 'boss-test', data: aiTestSchema.parse(data) });
  }
}
