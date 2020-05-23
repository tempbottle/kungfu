import click
import os
import shutil
import kungfu.yijinjing.journal as kfj
from kungfu.command.journal import journal, pass_ctx_from_parent

from pykungfu import yijinjing as yjj


@journal.command()
@click.pass_context
def archive(ctx):
    pass_ctx_from_parent(ctx)
    target_dir = os.path.join(os.path.dirname(ctx.home), 'archive')
    if os.path.exists(target_dir):
        shutil.rmtree(target_dir)
    os.makedirs(target_dir)
    target_locator = kfj.Locator(target_dir)
    assemble = yjj.assemble([ctx.locator])
    assemble >> target_locator
    # shutil.make_archive("yjj_archive", "zip", target_dir)