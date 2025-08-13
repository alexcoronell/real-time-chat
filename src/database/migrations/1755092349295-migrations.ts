import { MigrationInterface, QueryRunner } from 'typeorm';

/* Create Message Status Table */
export class Migrations1755092349295 implements MigrationInterface {
  name = 'Migrations1755092349295';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "message_status" ("id" SERIAL NOT NULL, "is_read" boolean NOT NULL DEFAULT false, "conversation_id" integer, "message_id" integer, "user_id" integer, CONSTRAINT "PK_fd8b82470959145fdf427784046" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`ALTER TABLE "conversations" ADD "userId" integer`);
    await queryRunner.query(
      `ALTER TABLE "message_status" ADD CONSTRAINT "FK_d48e5ed93e95146c1f435a7aae4" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "message_status" ADD CONSTRAINT "FK_ff8dd09dba401134707f7fdafd1" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "message_status" ADD CONSTRAINT "FK_4ae52d84e883c882b2f964d852f" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" ADD CONSTRAINT "FK_a9b3b5d51da1c75242055338b59" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "conversations" DROP CONSTRAINT "FK_a9b3b5d51da1c75242055338b59"`,
    );
    await queryRunner.query(
      `ALTER TABLE "message_status" DROP CONSTRAINT "FK_4ae52d84e883c882b2f964d852f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "message_status" DROP CONSTRAINT "FK_ff8dd09dba401134707f7fdafd1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "message_status" DROP CONSTRAINT "FK_d48e5ed93e95146c1f435a7aae4"`,
    );
    await queryRunner.query(`ALTER TABLE "conversations" DROP COLUMN "userId"`);
    await queryRunner.query(`DROP TABLE "message_status"`);
  }
}
