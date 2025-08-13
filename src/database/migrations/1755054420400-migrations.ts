import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1755054420400 implements MigrationInterface {
  name = 'Migrations1755054420400';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "conversations" ("id" SERIAL NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ee34f4f7ced4ec8681f26bf04ef" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "messages" ("id" SERIAL NOT NULL, "content" character varying NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "user_id" integer, "conversationId" integer, CONSTRAINT "PK_18325f38ae6de43878487eff986" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" SERIAL NOT NULL, "nickname" character varying NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_ad02a1be8707004cb805a4b5023" UNIQUE ("nickname"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "conversations_participants_users" ("conversationsId" integer NOT NULL, "usersId" integer NOT NULL, CONSTRAINT "PK_1242f5e8285ef060e51c52e6bdb" PRIMARY KEY ("conversationsId", "usersId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3a97ead02cb5c1e7a15edb5f64" ON "conversations_participants_users" ("conversationsId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0c719245d32a493067b54169eb" ON "conversations_participants_users" ("usersId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ADD CONSTRAINT "FK_830a3c1d92614d1495418c46736" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ADD CONSTRAINT "FK_e5663ce0c730b2de83445e2fd19" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations_participants_users" ADD CONSTRAINT "FK_3a97ead02cb5c1e7a15edb5f646" FOREIGN KEY ("conversationsId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations_participants_users" ADD CONSTRAINT "FK_0c719245d32a493067b54169ebc" FOREIGN KEY ("usersId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "conversations_participants_users" DROP CONSTRAINT "FK_0c719245d32a493067b54169ebc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations_participants_users" DROP CONSTRAINT "FK_3a97ead02cb5c1e7a15edb5f646"`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" DROP CONSTRAINT "FK_e5663ce0c730b2de83445e2fd19"`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" DROP CONSTRAINT "FK_830a3c1d92614d1495418c46736"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0c719245d32a493067b54169eb"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3a97ead02cb5c1e7a15edb5f64"`,
    );
    await queryRunner.query(`DROP TABLE "conversations_participants_users"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TABLE "messages"`);
    await queryRunner.query(`DROP TABLE "conversations"`);
  }
}
