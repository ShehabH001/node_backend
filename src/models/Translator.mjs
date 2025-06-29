import pool from "../database/connection.mjs";
import { validateCacheUtil } from "../utils/validateCache.mjs";
const darwinPool = pool.darwinPool;

//////////////////// Testing /////////////////

class Translator {
  static async validateCache(translator_ids, since) {
    return validateCacheUtil(
      "translator",
      "id",
      "write_date",
      translator_ids,
      since
    );
  }
  static async getAllTranslators(limit, offset) {
    const query = `SELECT * FROM translator LIMIT $1 OFFSET $2`;
    const values = [limit, offset];
    const { rows } = await darwinPool.query(query, values);
    return rows;
  }

  static async getTranslatorById(translator_id) {
    const query = `SELECT * FROM translator WHERE id = $1`;
    const values = [translator_id];
    const { rows } = await darwinPool.query(query, values);
    if (rows.length === 0) {
      throw new Error(`Translator with ID ${translator_id} not found`);
    }
    return rows[0];
  }

  static async getBookTranslators(book_id) {
    const query = `
    select * from 
      translator 
    join 
      product_template_translator_rel
    on 
      translator.id = product_template_translator_rel.translator_id
    where 
      product_template_translator_rel.product_template_id = $1`;
    const values = [book_id];
    const { rows } = await darwinPool.query(query, values);
    return rows;
  }

  ///////////////// until here /////////////////////////

  static async addBookTranslators(bookId, translators) {
    for (let i = 0; i < translators.length; i++) {
      await darwinPool.query(
        `insert into translator_product_template_rel (
                    product_template_id,
                    translator_id) values ($1,$2)`,
        [bookId, translators[i].translatorId]
      );
    }
  }
}

export default Translator;
